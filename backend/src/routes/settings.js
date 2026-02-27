import { Router } from 'express';
import { getDb, getSetting, setSetting } from '../services/database.js';
import { resetClient } from '../services/llm.js';

export const settingsRoutes = Router();

const ALLOWED_KEYS = [
  'openai_api_key',
  'openai_model',
  'github_token',
  'railway_token',
  'render_api_key',
  'test_threshold',
  'max_retries',
  'target_stack',
  'target_db',
];

const SENSITIVE_KEYS = ['openai_api_key', 'github_token', 'railway_token', 'render_api_key'];

/**
 * GET /api/settings
 * Returns all settings with sensitive values masked.
 */
settingsRoutes.get('/', (_req, res) => {
  const db = getDb();
  const rows = db.prepare('SELECT key, value FROM settings').all();

  const settings = {};
  for (const row of rows) {
    if (SENSITIVE_KEYS.includes(row.key)) {
      settings[row.key] = row.value ? `***${row.value.slice(-4)}` : null;
    } else {
      settings[row.key] = row.value;
    }
  }

  const envOverrides = {};
  if (process.env.OPENAI_API_KEY) envOverrides.openai_api_key = true;
  if (process.env.GITHUB_TOKEN) envOverrides.github_token = true;
  if (process.env.RAILWAY_TOKEN) envOverrides.railway_token = true;
  if (process.env.RENDER_API_KEY) envOverrides.render_api_key = true;

  res.json({ settings, envOverrides });
});

/**
 * PUT /api/settings
 * Update one or more settings.
 * Body: { key: value, ... }
 */
settingsRoutes.put('/', (req, res) => {
  const updates = req.body;

  if (!updates || typeof updates !== 'object') {
    return res.status(400).json({ error: 'Request body must be a JSON object of key-value pairs' });
  }

  const applied = [];
  const rejected = [];

  for (const [key, value] of Object.entries(updates)) {
    if (!ALLOWED_KEYS.includes(key)) {
      rejected.push({ key, reason: 'Unknown setting key' });
      continue;
    }

    if (typeof value !== 'string' && typeof value !== 'number') {
      rejected.push({ key, reason: 'Value must be a string or number' });
      continue;
    }

    setSetting(key, String(value));
    applied.push(key);

    if (key === 'openai_api_key') {
      resetClient();
    }
  }

  res.json({ applied, rejected });
});

/**
 * GET /api/settings/status
 * Check which integrations are configured.
 */
settingsRoutes.get('/status', (_req, res) => {
  const hasOpenAI = !!(process.env.OPENAI_API_KEY || getSetting('openai_api_key'));
  const hasGitHub = !!(process.env.GITHUB_TOKEN || getSetting('github_token'));
  const hasRailway = !!(process.env.RAILWAY_TOKEN || getSetting('railway_token'));
  const hasRender = !!(process.env.RENDER_API_KEY || getSetting('render_api_key'));

  res.json({
    openai: { configured: hasOpenAI, required: true },
    github: { configured: hasGitHub, required: false, description: 'Auto-create GitHub repos' },
    railway: { configured: hasRailway, required: false, description: 'Auto-deploy to Railway' },
    render: { configured: hasRender, required: false, description: 'Auto-deploy to Render' },
    ready: hasOpenAI,
  });
});