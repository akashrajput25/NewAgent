import axios from 'axios';
import type { Conversation, Message, GeneratedImage, PersonalityMode } from '../types';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

function assertConversationId(id: number | undefined | null): asserts id is number {
  if (typeof id !== 'number' || Number.isNaN(id)) {
    throw new Error('Invalid conversation id');
  }
}

function assertConversationResponse(data: unknown): asserts data is Conversation {
  if (!data || typeof data !== 'object' || !('id' in data) || typeof (data as any).id !== 'number') {
    throw new Error('Invalid conversation response from server');
  }
}

export async function getConversations(search?: string): Promise<Conversation[]> {
  const { data } = await api.get('/conversations', { params: search ? { search } : undefined });
  return data;
}

export async function getConversation(id: number): Promise<{ conversation: Conversation; messages: Message[] }> {
  assertConversationId(id);
  const { data } = await api.get(`/conversations/${id}`);
  return data;
}

export async function createConversation(title?: string, personality?: PersonalityMode): Promise<Conversation> {
  const { data } = await api.post('/conversations', { title, personality });
  assertConversationResponse(data);
  return data;
}

export async function deleteConversation(id: number): Promise<void> {
  assertConversationId(id);
  await api.delete(`/conversations/${id}`);
}

export async function updateConversation(id: number, updates: Partial<Conversation>): Promise<Conversation> {
  assertConversationId(id);
  const { data } = await api.patch(`/conversations/${id}`, updates);
  return data;
}

export async function sendMessageStream(
  conversationId: number,
  message: string,
  image?: string,
  personality?: PersonalityMode,
  temperature?: number,
  model?: string,
  systemPrompt?: string,
  thinkingMode?: boolean,
  onChunk: (chunk: string) => void = () => {},
  onToolCall: (tool: unknown) => void = () => {},
  onThinkingChunk: (chunk: string) => void = () => {},
  onDone: () => void = () => {},
): Promise<void> {
  const response = await fetch(`/api/chat/${conversationId}/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, image, personality, temperature, model, systemPrompt, thinkingMode }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let doneReceived = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split('\n').filter(Boolean);

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') {
          doneReceived = true;
          onDone();
          return;
        }
        try {
          const parsed = JSON.parse(data);
          if (parsed.type === 'text') {
            onChunk(parsed.data);
          } else if (parsed.type === 'thinking') {
            onThinkingChunk(parsed.data);
          } else if (parsed.type === 'tool') {
            onToolCall(parsed.data);
          } else if (parsed.type === 'error') {
            throw new Error(parsed.data);
          } else {
            onChunk(data);
          }
        } catch (error) {
          if (error instanceof SyntaxError) {
            onChunk(data);
          } else {
            throw error;
          }
        }
      }
    }
  }

  if (!doneReceived) {
    onDone();
  }
}

export async function generateImage(prompt: string): Promise<GeneratedImage> {
  const { data } = await api.post('/images/generate', { prompt });
  return data;
}

export async function getImageStatus(id: number): Promise<GeneratedImage> {
  const { data } = await api.get(`/images/status/${id}`);
  return data;
}

export async function uploadDocument(file: File, conversationId?: number): Promise<{ id: number; filename: string; text?: string }> {
  const formData = new FormData();
  formData.append('file', file);
  if (conversationId) formData.append('conversationId', String(conversationId));

  const { data } = await api.post('/documents/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function getDocument(id: number): Promise<{ id: number; text?: string; [key: string]: unknown }> {
  const { data } = await api.get(`/documents/${id}`);
  return data;
}

export async function exportConversation(id: number, format: 'markdown' | 'json' = 'markdown'): Promise<Blob> {
  assertConversationId(id);
  const response = await api.get(`/conversations/${id}/export`, {
    params: { format },
    responseType: 'blob',
  });
  return response.data;
}
