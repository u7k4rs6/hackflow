import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  FolderGit2,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Trash2,
  ExternalLink,
  Github,
} from 'lucide-react';
import { api } from '../api';

const STATUS_CONFIG = {
  pending: { icon: Clock, color: 'text-surface-400', bg: 'bg-surface-700', label: 'Pending' },
  planning: { icon: Loader2, color: 'text-blue-400', bg: 'bg-blue-900/30', label: 'Planning', spin: true },
  building: { icon: Loader2, color: 'text-amber-400', bg: 'bg-amber-900/30', label: 'Building', spin: true },
  testing: { icon: Loader2, color: 'text-purple-400', bg: 'bg-purple-900/30', label: 'Testing', spin: true },
  retrying: { icon: Loader2, color: 'text-orange-400', bg: 'bg-orange-900/30', label: 'Retrying', spin: true },
  deploying: { icon: Loader2, color: 'text-cyan-400', bg: 'bg-cyan-900/30', label: 'Deploying', spin: true },
  completed: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-900/30', label: 'Completed' },
  failed: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-900/30', label: 'Failed' },
  cancelled: { icon: XCircle, color: 'text-surface-500', bg: 'bg-surface-800', label: 'Cancelled' },
};

export default function ProjectsPage() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProjects();
    const interval = setInterval(loadProjects, 5000);
    return () => clearInterval(interval);
  }, []);

  async function loadProjects() {
    try {
      const data = await api.getProjects();
      setProjects(data.projects);
    } catch {
      // Silent fail for polling
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id, e) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Delete this project and all its data?')) return;
    try {
      await api.deleteProject(id);
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch {
      // Ignore
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-surface-500" />
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="text-center py-20 space-y-4">
        <FolderGit2 size={48} className="mx-auto text-surface-700" />
        <h2 className="text-xl font-semibold text-surface-300">No projects yet</h2>
        <p className="text-surface-500">
          Go to{' '}
          <Link to="/" className="text-blue-400 hover:underline">
            Launch
          </Link>{' '}
          to create your first AI-generated app.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Projects</h1>
        <span className="text-sm text-surface-500">{projects.length} total</span>
      </div>

      <div className="grid gap-3">
        {projects.map((project) => {
          const config = STATUS_CONFIG[project.status] || STATUS_CONFIG.pending;
          const Icon = config.icon;

          return (
            <Link
              key={project.id}
              to={`/projects/${project.id}`}
              className="flex items-center gap-4 bg-surface-900/50 hover:bg-surface-800/80 border border-surface-800 hover:border-surface-700 rounded-xl px-5 py-4 transition-all group"
            >
              <div className={`shrink-0 w-10 h-10 rounded-lg ${config.bg} flex items-center justify-center`}>
                <Icon size={20} className={`${config.color} ${config.spin ? 'animate-spin' : ''}`} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="font-medium text-surface-200 truncate group-hover:text-white transition-colors">
                  {project.name}
                </div>
                <div className="text-xs text-surface-500 truncate mt-0.5">
                  {project.idea}
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                {project.github_url && (
                  <a
                    href={project.github_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-surface-500 hover:text-surface-300 transition-colors"
                    title="GitHub repo"
                  >
                    <Github size={16} />
                  </a>
                )}
                {project.deploy_url && !project.deploy_url.startsWith('manual://') && (
                  <a
                    href={project.deploy_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="text-surface-500 hover:text-surface-300 transition-colors"
                    title="Live deployment"
                  >
                    <ExternalLink size={16} />
                  </a>
                )}

                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${config.bg} ${config.color}`}>
                  {config.label}
                </span>

                <span className="text-xs text-surface-600">
                  {formatDate(project.created_at)}
                </span>

                <button
                  onClick={(e) => handleDelete(project.id, e)}
                  className="text-surface-700 hover:text-red-400 transition-colors p-1"
                  title="Delete project"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr + 'Z');
  const now = new Date();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}