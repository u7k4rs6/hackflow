import { Router } from 'express';
import { getDb } from '../services/database.js';
import { startPipeline, getActiveRun, getAllActiveRuns } from '../services/orchestrator.js';

export const pipelineRoutes = Router();

/**
 * POST /api/pipeline/run
 * Start a new pipeline execution.
 * Body: { idea: string }
 * Returns: { projectId, status }
 */
pipelineRoutes.post('/run', async (req, res) => {
  const { idea } = req.body;

  if (!idea || typeof idea !== 'string' || idea.trim().length < 10) {
    return res.status(400).json({
      error: 'Invalid input',
      message: 'Provide an "idea" string with at least 10 characters describing the app you want to build.',
    });
  }

  try {
    const result = await startPipeline(idea.trim());

    res.json({
      projectId: result.projectId,
      status: result.status,
      message: 'Pipeline started. Poll /api/pipeline/status/:id for updates.',
    });
  } catch (err) {
    console.error('Pipeline start error:', err);
    res.status(500).json({ error: 'Failed to start pipeline', message: err.message });
  }
});

/**
 * GET /api/pipeline/status/:id
 * Get pipeline status + logs for a project.
 */
pipelineRoutes.get('/status/:id', (req, res) => {
  const { id } = req.params;
  const db = getDb();

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  const logs = db.prepare(
    'SELECT stage, status, message, data, created_at FROM pipeline_logs WHERE project_id = ? ORDER BY id ASC'
  ).all(id);

  const parsedLogs = logs.map((log) => ({
    ...log,
    data: log.data ? safeJsonParse(log.data) : null,
  }));

  // Merge live progress from active runs
  const activeRun = getActiveRun(id);

  res.json({
    id: project.id,
    name: project.name,
    idea: project.idea,
    status: project.status,
    currentStep: project.current_step,
    spec: safeJsonParse(project.spec),
    testResults: safeJsonParse(project.test_results),
    githubUrl: project.github_url,
    deployUrl: project.deploy_url,
    error: project.error,
    retryCount: project.retry_count,
    createdAt: project.created_at,
    updatedAt: project.updated_at,
    logs: parsedLogs,
    stages: computeStages(project.status, parsedLogs),
    live: activeRun ? {
      step: activeRun.step,
      progress: activeRun.progress,
    } : null,
  });
});

/**
 * GET /api/pipeline/logs/:id
 * Incremental log endpoint for polling.
 */
pipelineRoutes.get('/logs/:id', (req, res) => {
  const { id } = req.params;
  const db = getDb();

  const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(id);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  const afterId = parseInt(req.query.after || '0', 10);
  const logs = db.prepare(
    'SELECT id, stage, status, message, created_at FROM pipeline_logs WHERE project_id = ? AND id > ? ORDER BY id ASC'
  ).all(id, afterId);

  res.json({ logs });
});

/**
 * GET /api/pipeline/active
 * List all currently active pipeline runs.
 */
pipelineRoutes.get('/active', (_req, res) => {
  const runs = getAllActiveRuns();
  res.json({ active: runs, count: Object.keys(runs).length });
});

/**
 * POST /api/pipeline/cancel/:id
 * Cancel a running pipeline.
 */
pipelineRoutes.post('/cancel/:id', (req, res) => {
  const { id } = req.params;
  const db = getDb();

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  if (['completed', 'completed_with_warnings', 'failed'].includes(project.status)) {
    return res.status(400).json({ error: `Cannot cancel project in "${project.status}" state` });
  }

  db.prepare('UPDATE projects SET status = ?, error = ?, updated_at = datetime("now") WHERE id = ?')
    .run('cancelled', 'Cancelled by user', id);

  res.json({ status: 'cancelled' });
});

function computeStages(currentStatus, logs) {
  const stageOrder = ['planning', 'building', 'testing', 'retrying', 'github', 'deploy', 'completed'];
  const stageMap = {};

  for (const stage of stageOrder) {
    stageMap[stage] = { status: 'pending', message: null };
  }

  for (const log of logs) {
    const stage = log.stage;
    if (stageMap[stage]) {
      stageMap[stage].status = log.status;
      stageMap[stage].message = log.message;
    }
  }

  if (currentStatus === 'failed') {
    for (const stage of stageOrder) {
      if (stageMap[stage].status === 'pending') {
        stageMap[stage].status = 'skipped';
      }
    }
  }

  return stageMap;
}

function safeJsonParse(str) {
  if (!str) return null;
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}