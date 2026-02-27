const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const config = {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  };

  const res = await fetch(url, config);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || body.message || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  // Pipeline
  runPipeline: (idea) =>
    request('/api/pipeline/run', {
      method: 'POST',
      body: JSON.stringify({ idea }),
    }),

  getPipelineStatus: (id) =>
    request(`/api/pipeline/status/${id}`),

  getPipelineLogs: (id, afterId = 0) =>
    request(`/api/pipeline/logs/${id}?after=${afterId}`),

  cancelPipeline: (id) =>
    request(`/api/pipeline/cancel/${id}`, { method: 'POST' }),

  // Projects
  getProjects: () =>
    request('/api/projects'),

  getProject: (id) =>
    request(`/api/projects/${id}`),

  getProjectFiles: (id) =>
    request(`/api/projects/${id}/files`),

  getProjectFile: async (id, filePath) => {
    const url = `${BASE_URL}/api/projects/${id}/file/${filePath}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch file: ${filePath}`);
    return res.text();
  },

  downloadProject: (id) =>
    `${BASE_URL}/api/projects/${id}/download`,

  deleteProject: (id) =>
    request(`/api/projects/${id}`, { method: 'DELETE' }),

  // Settings
  getSettings: () =>
    request('/api/settings'),

  updateSettings: (settings) =>
    request('/api/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    }),

  getSettingsStatus: () =>
    request('/api/settings/status'),

  // Health
  healthCheck: () =>
    request('/api/health'),
};