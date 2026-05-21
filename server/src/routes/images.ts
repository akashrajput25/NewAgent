import { Router } from 'express';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import OpenAI from 'openai';
import db from '../db/connection.js';
import { config } from '../config.js';

const router = Router();

mkdirSync(config.generatedDir, { recursive: true });

router.post('/generate', async (req, res) => {
  const { prompt, conversationId } = req.body;

  const result = db.prepare(
    'INSERT INTO generated_images (conversation_id, prompt, url, status) VALUES (?, ?, ?, ?)'
  ).run(conversationId ? Number(conversationId) : null, prompt, '', 'pending');

  const id = result.lastInsertRowid as number;

  try {
    const client = new OpenAI({
      apiKey: config.openaiApiKey,
      baseURL: config.aiBaseUrl,
    });

    const response = await client.images.generate({
      model: 'dall-e-3',
      prompt,
      n: 1,
      size: '1024x1024',
      response_format: 'url',
    });

    if (!response.data || response.data.length === 0) {
      throw new Error('No image data returned from API');
    }
    const imageUrl = response.data[0].url;
    if (!imageUrl) {
      throw new Error('No image URL returned from API');
    }

    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to download image: ${imageResponse.status}`);
    }

    const buffer = Buffer.from(await imageResponse.arrayBuffer());
    const filename = `${Date.now()}.png`;
    const filepath = join(config.generatedDir, filename);
    writeFileSync(filepath, buffer);

    const fileUrl = `/api/images/file/${filename}`;
    db.prepare('UPDATE generated_images SET url = ?, status = ? WHERE id = ?').run(
      fileUrl,
      'completed',
      id
    );

    const image = db.prepare('SELECT * FROM generated_images WHERE id = ?').get(id) as Record<string, unknown>;
    res.status(201).json(image);
  } catch (error) {
    console.error('Image generation error:', error);
    db.prepare('UPDATE generated_images SET status = ? WHERE id = ?').run('failed', id);
    res.status(500).json({ error: 'Image generation failed', details: String(error) });
  }
});

router.get('/file/:filename', (req, res) => {
  const filename = req.params.filename;
  const filepath = join(config.generatedDir, filename);
  res.sendFile(filepath, (err) => {
    if (err) {
      res.status(404).json({ error: 'Image not found' });
    }
  });
});

router.get('/status/:id', (req, res) => {
  const id = Number(req.params.id);
  const image = db.prepare('SELECT * FROM generated_images WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!image) {
    res.status(404).json({ error: 'Image not found' });
    return;
  }
  res.json(image);
});

export default router;
