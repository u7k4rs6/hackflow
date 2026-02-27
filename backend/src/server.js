import express from 'express';
import cors from 'cors';
import { initDatabase } from './services/database.js';
import { pipelineRoutes } from './routes/pipeline.js';
import { projectRoutes } from './routes/projects.js';
import { settingsRoutes } from './routes/settings.js';

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

// Routes
app.use('/api/pipeline', pipelineRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/settings', settingsRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'autoship-engine',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Initialize database
initDatabase();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`AutoShip engine running on http://0.0.0.0:${PORT}`);
});