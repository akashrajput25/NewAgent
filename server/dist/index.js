import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import conversationRoutes from './routes/conversations.js';
import chatRoutes from './routes/chat.js';
import imageRoutes from './routes/images.js';
import documentRoutes from './routes/documents.js';
const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
mkdirSync(config.uploadsDir, { recursive: true });
mkdirSync(config.generatedDir, { recursive: true });
mkdirSync(config.workspaceDir, { recursive: true });
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: '50mb' }));
app.use(express.static(config.generatedDir));
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
});
app.use(limiter);
app.use('/api/conversations', conversationRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/images', imageRoutes);
app.use('/api/documents', documentRoutes);
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', provider: config.anthropicApiKey ? 'anthropic' : config.openaiApiKey ? 'openai' : 'none' });
});
// Serve built frontend
const clientDist = join(__dirname, '../../client/dist');
app.use(express.static(clientDist));
app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/'))
        return next();
    res.sendFile(join(clientDist, 'index.html'));
});
app.listen(config.port, () => {
    console.log(`Server running on port ${config.port}`);
});
//# sourceMappingURL=index.js.map