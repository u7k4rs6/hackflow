import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = join(__dirname, '..', '..', 'database.db');
let db;

export function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

export function initDatabase() {
  const conn = getDb();

  conn.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      idea TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      current_step TEXT NOT NULL DEFAULT 'queued',
      spec TEXT,
      generated_files TEXT,
      test_files TEXT,
      test_results TEXT,
      github_url TEXT,
      deploy_url TEXT,
      error TEXT,
      retry_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS pipeline_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id TEXT NOT NULL,
      stage TEXT NOT NULL,
      status TEXT NOT NULL,
      message TEXT,
      data TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  const existing = conn.prepare('SELECT key FROM settings WHERE key = ?').get('openai_model');
  if (!existing) {
    const defaults = [
      ['openai_model', 'gpt-4o'],
      ['test_threshold', '80'],
      ['max_retries', '1'],
    ];
    const insert = conn.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
    for (const [key, value] of defaults) {
      insert.run(key, value);
    }
  }

  console.log('Database initialized at', DB_PATH);
}

export function getSetting(key) {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : null;
}

export function setSetting(key, value) {
  getDb().prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
}

export function createProject(id, name, idea) {
  getDb().prepare(`
    INSERT INTO projects (id, name, idea, status, current_step)
    VALUES (?, ?, ?, 'pending', 'queued')
  `).run(id, name, idea);
  return getProject(id);
}

export function getProject(id) {
  const row = getDb().prepare('SELECT * FROM projects WHERE id = ?').get(id);
  if (!row) return null;
  return {
    ...row,
    spec: row.spec ? JSON.parse(row.spec) : null,
    generated_files: row.generated_files ? JSON.parse(row.generated_files) : null,
    test_files: row.test_files ? JSON.parse(row.test_files) : null,
    test_results: row.test_results ? JSON.parse(row.test_results) : null,
  };
}

export function updateProject(id, fields) {
  const keys = Object.keys(fields);
  if (keys.length === 0) return;
  const sets = keys.map(k => `${k} = ?`).join(', ');
  const values = keys.map(k => {
    const v = fields[k];
    return (v !== null && typeof v === 'object') ? JSON.stringify(v) : v;
  });
  values.push(id);
  getDb().prepare(`UPDATE projects SET ${sets}, updated_at = datetime('now') WHERE id = ?`).run(...values);
}

export function listProjects(limit = 50, offset = 0) {
  return getDb().prepare(`
    SELECT id, name, idea, status, current_step, github_url, deploy_url, error, retry_count, created_at, updated_at
    FROM projects ORDER BY created_at DESC LIMIT ? OFFSET ?
  `).all(limit, offset);
}

export function deleteProject(id) {
  getDb().prepare('DELETE FROM pipeline_logs WHERE project_id = ?').run(id);
  getDb().prepare('DELETE FROM projects WHERE id = ?').run(id);
}

export function addLog(projectId, stage, status, message, data = null) {
  getDb().prepare(`
    INSERT INTO pipeline_logs (project_id, stage, status, message, data)
    VALUES (?, ?, ?, ?, ?)
  `).run(projectId, stage, status, message, data ? JSON.stringify(data) : null);
}

export function getProjectLogs(projectId) {
  return getDb().prepare(`
    SELECT * FROM pipeline_logs WHERE project_id = ? ORDER BY created_at ASC
  `).all(projectId).map(log => ({
    ...log,
    data: log.data ? JSON.parse(log.data) : null,
  }));
}