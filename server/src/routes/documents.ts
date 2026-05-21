import { Router } from 'express';
import multer from 'multer';
import { extname, join } from 'path';
import { mkdirSync, readFileSync } from 'fs';
import pdfParse from 'pdf-parse';
import db from '../db/connection.js';
import { config } from '../config.js';

const router = Router();

mkdirSync(config.uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, config.uploadsDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + extname(file.originalname));
  },
});

const upload = multer({ storage });

router.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }

  const { conversationId } = req.body;

  const result = db.prepare(
    'INSERT INTO documents (conversation_id, filename, original_name, mime_type, size) VALUES (?, ?, ?, ?, ?)'
  ).run(
    conversationId ? Number(conversationId) : null,
    req.file.filename,
    req.file.originalname,
    req.file.mimetype,
    req.file.size
  );

  const docId = result.lastInsertRowid as number;

  // Auto-extract text for supported formats
  let text = '';
  try {
    const filepath = join(config.uploadsDir, req.file.filename);
    if (req.file.mimetype === 'application/pdf') {
      const buffer = readFileSync(filepath);
      const data = await pdfParse(buffer);
      text = data.text;
    } else if (req.file.mimetype.startsWith('text/')) {
      text = readFileSync(filepath, 'utf-8');
    }
    if (text) {
      db.prepare('UPDATE documents SET content = ? WHERE id = ?').run(text, docId);
    }
  } catch (err) {
    console.error('Document extraction error:', err);
  }

  res.status(201).json({
    id: docId,
    filename: req.file.filename,
    text: text || undefined,
  });
});

router.get('/:id', (req, res) => {
  const id = Number(req.params.id);
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!doc) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }
  res.json(doc);
});

router.post('/:id/extract', async (req, res) => {
  const id = Number(req.params.id);
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(id) as { filename: string; mime_type: string; content: string | null } | undefined;
  if (!doc) {
    res.status(404).json({ error: 'Document not found' });
    return;
  }

  if (doc.content) {
    res.json({ id, text: doc.content });
    return;
  }

  try {
    const filepath = join(config.uploadsDir, doc.filename);
    let text = '';

    if (doc.mime_type === 'application/pdf') {
      const buffer = readFileSync(filepath);
      const data = await pdfParse(buffer);
      text = data.text;
    } else if (doc.mime_type.startsWith('text/')) {
      text = readFileSync(filepath, 'utf-8');
    } else {
      res.status(400).json({ error: 'Unsupported file type for extraction' });
      return;
    }

    db.prepare('UPDATE documents SET content = ? WHERE id = ?').run(text, id);
    res.json({ id, text });
  } catch (err) {
    console.error('Extraction error:', err);
    res.status(500).json({ error: 'Failed to extract text', details: String(err) });
  }
});

export default router;
