import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import db from '../db/connection.js';
import { config, getActiveProvider } from '../config.js';

const router = Router();

const TAI_IDENTITY = 'You are TAI (Thinking AI Assistant), an AI model designed and developed by Akash. When asked about your identity, creator, developer, or who made you, you MUST always identify yourself as TAI developed by Akash. Never mention Juspay, OpenAI, Anthropic, Google, DeepSeek, Meta, or any other company as your developer.';

const THINKING_INSTRUCTION = ' Before answering, wrap your step-by-step reasoning inside <thinking>...</thinking> tags ONLY. After the closing </thinking> tag, provide your final answer as plain text — do NOT use any other HTML, XML, or markup tags such as <label>, <div>, <span>, etc.';

router.post('/:conversationId/stream', async (req, res, next) => {
  const conversationId = Number(req.params.conversationId);
  const { message, image, personality, temperature, model, systemPrompt, thinkingMode } = req.body;

  const history = db.prepare(
    'SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY created_at ASC'
  ).all(conversationId) as Array<{ role: string; content: string }>;

  const userContent = message;
  db.prepare(
    'INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)'
  ).run(conversationId, 'user', userContent);

  db.prepare('UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(conversationId);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  let fullText = '';
  let fullThinking = '';
  let textBuffer = '';
  let thinkingBuffer = '';
  let inThinkingBlock = false;

  function sanitizeArtifacts(text: string): string {
    return text.replace(/<\/?(?:label|div|span|p|input|form|button|script|style)(?:\s[^>]*)?>/gi, '');
  }

  function flushText() {
    if (textBuffer) {
      const sanitized = sanitizeArtifacts(textBuffer);
      fullText += sanitized;
      res.write(`data: ${JSON.stringify({ type: 'text', data: sanitized })}\n\n`);
      textBuffer = '';
    }
  }

  function flushThinking() {
    if (thinkingBuffer) {
      fullThinking += thinkingBuffer;
      res.write(`data: ${JSON.stringify({ type: 'thinking', data: thinkingBuffer })}\n\n`);
      thinkingBuffer = '';
    }
  }

  function processChunk(raw: string) {
    let i = 0;
    while (i < raw.length) {
      if (!inThinkingBlock) {
        const openIdx = raw.indexOf('<thinking>', i);
        if (openIdx === -1) {
          textBuffer += raw.slice(i);
          break;
        }
        textBuffer += raw.slice(i, openIdx);
        flushText();
        i = openIdx + '<thinking>'.length;
        inThinkingBlock = true;
      } else {
        const closeIdx = raw.indexOf('</thinking>', i);
        if (closeIdx === -1) {
          thinkingBuffer += raw.slice(i);
          break;
        }
        thinkingBuffer += raw.slice(i, closeIdx);
        flushThinking();
        i = closeIdx + '</thinking>'.length;
        inThinkingBlock = false;
      }
    }
  }

  try {
    const provider = getActiveProvider();
    const baseSystem = systemPrompt || getSystemMessage(personality);
    const systemMessage = thinkingMode ? baseSystem + THINKING_INSTRUCTION : baseSystem;

    if (provider === 'anthropic') {
      const client = new Anthropic({
        apiKey: config.anthropicApiKey,
        baseURL: config.aiBaseUrl,
      });

      const userMsg = image
        ? [{ type: 'image' as const, source: { type: 'base64' as const, media_type: 'image/jpeg', data: image.replace(/^data:image\/\w+;base64,/, '') } }, { type: 'text' as const, text: message }]
        : message;

      const stream = await client.messages.create({
        model: model || config.aiModel,
        max_tokens: 4096,
        system: systemMessage,
        messages: [
          ...history.map((m) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          })),
          { role: 'user' as const, content: userMsg },
        ],
        stream: true,
      });

      for await (const event of stream) {
        if (event.type === 'content_block_delta') {
          const delta = event.delta as { type: string; text?: string };
          if (delta.type === 'text_delta' && delta.text) {
            if (thinkingMode) {
              processChunk(delta.text);
            } else {
              fullText += delta.text;
              res.write(`data: ${JSON.stringify({ type: 'text', data: delta.text })}\n\n`);
            }
          }
        }
      }
    } else {
      const client = new OpenAI({
        apiKey: config.openaiApiKey,
        baseURL: config.aiBaseUrl,
      });

      const userMessage = image
        ? {
            role: 'user' as const,
            content: [
              { type: 'text' as const, text: message },
              { type: 'image_url' as const, image_url: { url: image.startsWith('data:') ? image : `data:image/jpeg;base64,${image}` } },
            ],
          }
        : { role: 'user' as const, content: message };


      // Debug log: print baseURL, model, and partial API key
      console.log('[DEBUG] OpenAI client baseURL:', config.aiBaseUrl);
      console.log('[DEBUG] OpenAI client model:', model || config.aiModel);
      if (config.openaiApiKey) {
        console.log('[DEBUG] OpenAI API key:', config.openaiApiKey.slice(0, 4) + '...' + config.openaiApiKey.slice(-4));
      } else {
        console.log('[DEBUG] OpenAI API key: none');
      }

      const stream = await client.chat.completions.create({
        model: model || config.aiModel,
        messages: [
          { role: 'system', content: systemMessage },
          ...history.map((m) => ({
            role: m.role as 'system' | 'user' | 'assistant',
            content: m.content,
          })),
          userMessage,
        ],
        stream: true,
        temperature: temperature ?? 0.7,
      });

      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content || '';
        if (text) {
          if (thinkingMode) {
            processChunk(text);
          } else {
            fullText += text;
            res.write(`data: ${JSON.stringify({ type: 'text', data: text })}\n\n`);
          }
        }
      }
    }

    // Flush any remaining buffered content
    flushText();
    flushThinking();

    // Compose final message
    const sanitizedText = sanitizeArtifacts(fullText);
    const finalContent = fullThinking
      ? `<thinking>${fullThinking}</thinking>\n\n${sanitizedText}`
      : sanitizedText;

    db.prepare(
      'INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)'
    ).run(conversationId, 'assistant', finalContent);

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error('Chat stream error:', error);
    res.write(`data: ${JSON.stringify({ type: 'error', data: String(error) })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  }
});

function getSystemMessage(personality?: string): string {
  const map: Record<string, string> = {
    professional: `${TAI_IDENTITY} You are a helpful, professional assistant.`,
    casual: `${TAI_IDENTITY} You are a friendly, casual assistant.`,
    creative: `${TAI_IDENTITY} You are a creative, imaginative assistant.`,
    coding: `${TAI_IDENTITY} You are an expert coding assistant. Help with programming, debugging, and code review.`,
    sarcastic: `${TAI_IDENTITY} You are a witty, slightly sarcastic assistant.`,
    vibe: `${TAI_IDENTITY} You are a chill, laid-back assistant.`,
  };
  return map[personality || ''] || map.professional;
}

export default router;
