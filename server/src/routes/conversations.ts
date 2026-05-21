import { Router } from 'express';
import db from '../db/connection.js';

const router = Router();

router.get('/', (req, res) => {
  const search = req.query.search as string | undefined;

  if (search) {
    const rows = db.prepare(`
      SELECT DISTINCT c.*, COUNT(m.id) as message_count
      FROM conversations c
      LEFT JOIN messages m ON m.conversation_id = c.id
      WHERE c.title LIKE ? OR m.content LIKE ?
      GROUP BY c.id
      ORDER BY c.updated_at DESC
    `).all(`%${search}%`, `%${search}%`) as Array<Record<string, unknown>>;
    res.json(rows);
  } else {
    const rows = db.prepare(`
      SELECT c.*, COUNT(m.id) as message_count
      FROM conversations c
      LEFT JOIN messages m ON m.conversation_id = c.id
      GROUP BY c.id
      ORDER BY c.updated_at DESC
    `).all() as Array<Record<string, unknown>>;
    res.json(rows);
  }
});

router.get('/:id', (req, res) => {
  const id = Number(req.params.id);
  const conversation = db.prepare('SELECT * FROM conversations WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!conversation) {
    res.status(404).json({ error: 'Conversation not found' });
    return;
  }
  const messages = db.prepare('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC').all(id) as Array<Record<string, unknown>>;
  res.json({ conversation, messages });
});

router.get('/:id/export', (req, res) => {
  const id = Number(req.params.id);
  const format = req.query.format as string || 'markdown';

  const conversation = db.prepare('SELECT * FROM conversations WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!conversation) {
    res.status(404).json({ error: 'Conversation not found' });
    return;
  }

  const messages = db.prepare('SELECT role, content, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at ASC').all(id) as Array<{ role: string; content: string; created_at: string }>;

  if (format === 'json') {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="conversation-${id}.json"`);
    res.json({ conversation, messages });
    return;
  }

  // Markdown export (default)
  let markdown = `# ${conversation.title}\n\n`;
  markdown += `**Personality:** ${conversation.personality}\n`;
  markdown += `**Created:** ${conversation.created_at}\n\n`;
  markdown += '---\n\n';

  for (const msg of messages) {
    const roleLabel = msg.role.charAt(0).toUpperCase() + msg.role.slice(1);
    markdown += `### ${roleLabel}\n\n${msg.content}\n\n---\n\n`;
  }

  res.setHeader('Content-Type', 'text/markdown');
  res.setHeader('Content-Disposition', `attachment; filename="conversation-${id}.md"`);
  res.send(markdown);
});

router.post('/', (req, res) => {
  const { title, personality } = req.body;
  const result = db.prepare(
    'INSERT INTO conversations (title, personality) VALUES (?, ?)'
  ).run(title || 'New Conversation', personality || 'professional');

  const conversation = db.prepare('SELECT * FROM conversations WHERE id = ?').get(result.lastInsertRowid) as Record<string, unknown>;
  res.status(201).json(conversation);
});

router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  db.prepare('DELETE FROM conversations WHERE id = ?').run(id);
  res.status(204).send();
});

router.patch('/:id', (req, res) => {
  const id = Number(req.params.id);
  const { title, personality } = req.body;
  const fields: string[] = [];
  const values: unknown[] = [];

  if (title !== undefined) { fields.push('title = ?'); values.push(title); }
  if (personality !== undefined) { fields.push('personality = ?'); values.push(personality); }

  if (fields.length === 0) {
    res.status(400).json({ error: 'No fields to update' });
    return;
  }

  values.push(id);
  db.prepare(`UPDATE conversations SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(...values);

  const conversation = db.prepare('SELECT * FROM conversations WHERE id = ?').get(id) as Record<string, unknown>;
  res.json(conversation);
});

export default router;
