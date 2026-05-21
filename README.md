# AI Agent Web App

## Environment Variables

Create a `.env` file in the `server/` directory:

```env
# AI Provider (choose one or both)
ANTHROPIC_API_KEY=your_anthropic_key
OPENAI_API_KEY=your_openai_key

# Optional: Override model and endpoint
AI_MODEL=claude-3-5-sonnet-20241022
AI_BASE_URL=

# Server
PORT=3001
```

## Development

```bash
# Install all dependencies
npm install

# Start both client and server
npm run dev
```

Client runs on http://localhost:5173
Server runs on http://localhost:3001
