import express from 'express';
import { config } from 'dotenv';

config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Placeholder routes — will implement these
app.post('/strategy/generate', (_req, res) => {
  res.status(501).json({ error: 'not implemented yet' });
});

app.get('/strategy/:familyId', (_req, res) => {
  res.status(501).json({ error: 'not implemented yet' });
});

app.listen(PORT, () => {
  console.log(`[StrategyForge Server] listening on port ${PORT}`);
});
