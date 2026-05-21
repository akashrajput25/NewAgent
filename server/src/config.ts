import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  aiModel: process.env.AI_MODEL || 'claude-3-5-sonnet-20241022',
  aiBaseUrl: process.env.AI_BASE_URL || undefined,
  dbPath: process.env.DB_PATH || join(__dirname, '../../data/agent.db'),
  uploadsDir: join(__dirname, '../../uploads'),
  generatedDir: join(__dirname, '../../public/generated'),
  workspaceDir: join(__dirname, '../../workspace'),
} as const;

export type AIProvider = 'anthropic' | 'openai';

export function getActiveProvider(): AIProvider {
  if (config.anthropicApiKey) return 'anthropic';
  if (config.openaiApiKey) return 'openai';
  throw new Error('No AI provider API key configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY.');
}
