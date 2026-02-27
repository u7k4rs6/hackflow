import { Router } from 'express';
import { getDb } from '../services/database.js';
import archiver from 'archiver';

export const projectRoutes = Router();

/**
 * GET /api/projects
 * List all projects, most recent first.
 */
projectRoutes.get('/', (_req, res) => {
  const db = getDb();
  const projects = db.prepare(
    'SELECT id, name, idea, status, github_url, deploy_url, error, retry_count, created_at, updated_at FROM projects ORDER BY created_at DESC'
  ).all();

  res.json({ projects });
});

/**
 * GET /api/projects/:id
 * Get full project details.
 */
projectRoutes.get('/:id', (req, res) => {
  const { id } = req.params;
  const db = getDb();

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  res.json({
    ...project,
    spec: safeJsonParse(project.spec),
    generated_files: safeJsonParse(project.generated_files),
    test_results: safeJsonParse(project.test_results),
  });
});

/**
 * GET /api/projects/:id/files
 * Get generated file listing for a project.
 */
projectRoutes.get('/:id/files', (req, res) => {
  const { id } = req.params;
  const db = getDb();

  const project = db.prepare('SELECT generated_files FROM projects WHERE id = ?').get(id);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  const files = safeJsonParse(project.generated_files);
  if (!files) {
    return res.json({ files: {} });
  }

  const fileListing = {};
  for (const [path, content] of Object.entries(files)) {
    fileListing[path] = {
      path,
      size: Buffer.byteLength(content, 'utf-8'),
      lines: content.split('\n').length,
    };
  }

  res.json({ files: fileListing });
});

/**
 * GET /api/projects/:id/files/:filePath
 * Get content of a specific generated file.
 */
projectRoutes.get('/:id/file/*', (req, res) => {
  const { id } = req.params;
  const filePath = req.params[0];
  const db = getDb();

  const project = db.prepare('SELECT generated_files FROM projects WHERE id = ?').get(id);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  const files = safeJsonParse(project.generated_files);
  if (!files || !files[filePath]) {
    return res.status(404).json({ error: `File not found: ${filePath}` });
  }

  res.type('text/plain').send(files[filePath]);
});

/**
 * GET /api/projects/:id/download
 * Download all generated files as a zip archive.
 */
projectRoutes.get('/:id/download', (req, res) => {
  const { id } = req.params;
  const db = getDb();

  const project = db.prepare('SELECT name, generated_files FROM projects WHERE id = ?').get(id);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  const files = safeJsonParse(project.generated_files);
  if (!files) {
    return res.status(400).json({ error: 'No generated files available' });
  }

  const safeName = (project.name || 'project')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .substring(0, 50);

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}.zip"`);

  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.pipe(res);

  for (const [filePath, content] of Object.entries(files)) {
    archive.append(content, { name: filePath });
  }

  archive.finalize();
});

/**
 * DELETE /api/projects/:id
 * Delete a project and its logs.
 */
projectRoutes.delete('/:id', (req, res) => {
  const { id } = req.params;
  const db = getDb();

  const project = db.prepare('SELECT id FROM projects WHERE id = ?').get(id);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  db.prepare('DELETE FROM pipeline_logs WHERE project_id = ?').run(id);
  db.prepare('DELETE FROM projects WHERE id = ?').run(id);

  res.json({ deleted: true });
});

function safeJsonParse(str) {
  if (!str) return null;
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}