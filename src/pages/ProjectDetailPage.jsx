import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Loader2,
  Github,
  ExternalLink,
  Download,
  FileCode,
  Database,
  TestTube2,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
} from 'lucide-react';
import { api } from '../api';

export default function ProjectDetailPage() {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [fileContents, setFileContents] = useState({});
  const [expandedFile, setExpandedFile] = useState(null);
  const [copiedFile, setCopiedFile] = useState(null);

  const loadProject = useCallback(async () => {
    try {
      const data = await api.getProject(id);
      setProject(data);
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadProject();
    const interval = setInterval(loadProject, 4000);
    return () => clearInterval(interval);
  }, [loadProject]);

  async function loadFileContent(filePath) {
    if (fileContents[filePath]) return;
    try {
      const content = await api.getProjectFile(id, filePath);
      setFileContents((prev) => ({ ...prev, [filePath]: content }));
    } catch {
      setFileContents((prev) => ({ ...prev, [filePath]: '// Failed to load file content' }));
    }
  }

  function toggleFile(filePath) {
    if (expandedFile === filePath) {
      setExpandedFile(null);
    } else {
      setExpandedFile(filePath);
      loadFileContent(filePath);
    }
  }

  async function copyToClipboard(content, filePath) {
    await navigator.clipboard.writeText(content);
    setCopiedFile(filePath);
    setTimeout(() => setCopiedFile(null), 2000);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-surface-500" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-20">
        <p className="text-surface-400">Project not found</p>
        <Link to="/projects" className="text-blue-400 hover:underline text-sm mt-2 inline-block">
          Back to projects
        </Link>
      </div>
    );
  }

  const spec = typeof project.spec === 'string' ? safeJsonParse(project.spec) : project.spec;
  const files = typeof project.generated_files === 'string' ? safeJsonParse(project.generated_files) : project.generated_files;
  const testResults = typeof project.test_results === 'string' ? safeJsonParse(project.test_results) : project.test_results;
  const isRunning = ['pending', 'planning', 'building', 'testing', 'retrying', 'deploying'].includes(project.status);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/projects" className="text-surface-500 hover:text-surface-300 transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{spec?.display_name || project.name}</h1>
          <p className="text-sm text-surface-500 mt-0.5">{project.idea}</p>
        </div>
        <StatusBadge status={project.status} />
      </div>

      {/* Quick links */}
      <div className="flex items-center gap-3 flex-wrap">
        {project.github_url && (
          <a
            href={project.github_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-surface-800 hover:bg-surface-700 border border-surface-700 rounded-lg px-4 py-2 text-sm text-surface-300 hover:text-white transition-all"
          >
            <Github size={16} />
            GitHub Repo
          </a>
        )}
        {project.deploy_url && !project.deploy_url.startsWith('manual://') && (
          <a
            href={project.deploy_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 rounded-lg px-4 py-2 text-sm text-blue-300 hover:text-blue-200 transition-all"
          >
            <ExternalLink size={16} />
            Live App
          </a>
        )}
        {files && (
          <a
            href={api.downloadProject(id)}
            className="inline-flex items-center gap-2 bg-surface-800 hover:bg-surface-700 border border-surface-700 rounded-lg px-4 py-2 text-sm text-surface-300 hover:text-white transition-all"
          >
            <Download size={16} />
            Download ZIP
          </a>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-surface-800 flex gap-0">
        {['overview', 'files', 'tests'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-3 text-sm font-medium border-b-2 transition-all capitalize ${
              activeTab === tab
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-surface-500 hover:text-surface-300'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <OverviewTab spec={spec} project={project} files={files} testResults={testResults} isRunning={isRunning} />
      )}

      {activeTab === 'files' && (
        <FilesTab
          files={files}
          expandedFile={expandedFile}
          fileContents={fileContents}
          copiedFile={copiedFile}
          toggleFile={toggleFile}
          copyToClipboard={copyToClipboard}
        />
      )}

      {activeTab === 'tests' && <TestsTab testResults={testResults} />}
    </div>
  );
}

function OverviewTab({ spec, project, files, testResults, isRunning }) {
  if (isRunning) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center space-y-3">
          <Loader2 size={32} className="animate-spin text-blue-400 mx-auto" />
          <p className="text-surface-400">Pipeline is running...</p>
          <p className="text-xs text-surface-600 capitalize">{project.status}</p>
        </div>
      </div>
    );
  }

  if (!spec) {
    return <p className="text-surface-500 py-8">No specification generated yet.</p>;
  }

  return (
    <div className="space-y-8">
      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          icon={Database}
          label="Models"
          value={spec.models?.length || 0}
          color="text-blue-400"
        />
        <StatCard
          icon={FileCode}
          label="Endpoints"
          value={spec.endpoints?.length || 0}
          color="text-emerald-400"
        />
        <StatCard
          icon={FileCode}
          label="Files"
          value={files ? Object.keys(files).length : 0}
          color="text-amber-400"
        />
        <StatCard
          icon={TestTube2}
          label="Tests"
          value={testResults ? `${testResults.percentage || 0}%` : 'N/A'}
          color="text-purple-400"
        />
      </div>

      {/* Models */}
      {spec.models && spec.models.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-surface-400 uppercase tracking-wider">Data Models</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            {spec.models.map((model, i) => (
              <div key={i} className="bg-surface-900/50 border border-surface-800 rounded-xl p-4 space-y-2">
                <div className="font-medium text-surface-200 flex items-center gap-2">
                  <Database size={14} className="text-blue-400" />
                  {model.name}
                </div>
                <div className="space-y-1">
                  {model.fields?.map((field, j) => (
                    <div key={j} className="flex items-center gap-2 text-xs">
                      <span className="text-surface-400 font-mono">{field.name}</span>
                      <span className="text-surface-600">{field.type}</span>
                      {field.required && (
                        <span className="text-amber-500/70 text-[10px]">required</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Endpoints */}
      {spec.endpoints && spec.endpoints.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-surface-400 uppercase tracking-wider">API Endpoints</h3>
          <div className="bg-surface-900/50 border border-surface-800 rounded-xl overflow-hidden">
            <div className="divide-y divide-surface-800">
              {spec.endpoints.map((ep, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <MethodBadge method={ep.method} />
                  <span className="font-mono text-surface-300 text-xs">{ep.path}</span>
                  <span className="text-surface-600 text-xs ml-auto hidden sm:inline">{ep.description}</span>
                  {ep.auth_required && (
                    <span className="text-amber-500/70 text-[10px] border border-amber-500/20 rounded px-1.5 py-0.5">auth</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Features */}
      {spec.features && spec.features.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-surface-400 uppercase tracking-wider">Features</h3>
          <ul className="space-y-1.5">
            {spec.features.map((feature, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-surface-300">
                <CheckCircle2 size={14} className="text-emerald-500 mt-0.5 shrink-0" />
                {feature}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Error */}
      {project.error && (
        <div className="bg-red-950/30 border border-red-800/40 rounded-xl p-4 space-y-1">
          <div className="flex items-center gap-2 text-red-400 font-medium text-sm">
            <XCircle size={16} />
            Pipeline Error
          </div>
          <p className="text-xs text-red-300/80 font-mono">{project.error}</p>
        </div>
      )}
    </div>
  );
}

function FilesTab({ files, expandedFile, fileContents, copiedFile, toggleFile, copyToClipboard }) {
  if (!files || Object.keys(files).length === 0) {
    return <p className="text-surface-500 py-8">No files generated yet.</p>;
  }

  const filePaths = Object.keys(files).sort();

  return (
    <div className="space-y-1">
      {filePaths.map((filePath) => {
        const isExpanded = expandedFile === filePath;
        const content = fileContents[filePath] || files[filePath];
        const isCopied = copiedFile === filePath;

        return (
          <div key={filePath} className="border border-surface-800 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleFile(filePath)}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-surface-800/50 transition-colors text-sm"
            >
              {isExpanded ? (
                <ChevronDown size={14} className="text-surface-500" />
              ) : (
                <ChevronRight size={14} className="text-surface-500" />
              )}
              <FileCode size={14} className="text-blue-400" />
              <span className="font-mono text-surface-300 text-xs">{filePath}</span>
            </button>

            {isExpanded && content && (
              <div className="relative border-t border-surface-800">
                <button
                  onClick={() => copyToClipboard(content, filePath)}
                  className="absolute top-2 right-2 text-surface-500 hover:text-surface-300 transition-colors p-1.5 bg-surface-800 rounded"
                  title="Copy file content"
                >
                  {isCopied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                </button>
                <pre className="p-4 text-xs text-surface-300 font-mono overflow-x-auto max-h-96 bg-surface-950/50 leading-relaxed">
                  {content}
                </pre>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function TestsTab({ testResults }) {
  if (!testResults) {
    return <p className="text-surface-500 py-8">No test results available yet.</p>;
  }

  const passRate = testResults.percentage || 0;
  const isPassing = passRate >= 80;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-surface-900/50 border border-surface-800 rounded-xl p-4 text-center">
          <div className={`text-3xl font-bold ${isPassing ? 'text-emerald-400' : 'text-red-400'}`}>
            {passRate}%
          </div>
          <div className="text-xs text-surface-500 mt-1">Pass Rate</div>
        </div>
        <div className="bg-surface-900/50 border border-surface-800 rounded-xl p-4 text-center">
          <div className="text-3xl font-bold text-emerald-400">{testResults.passed || 0}</div>
          <div className="text-xs text-surface-500 mt-1">Passed</div>
        </div>
        <div className="bg-surface-900/50 border border-surface-800 rounded-xl p-4 text-center">
          <div className="text-3xl font-bold text-red-400">{testResults.failed || 0}</div>
          <div className="text-xs text-surface-500 mt-1">Failed</div>
        </div>
        <div className="bg-surface-900/50 border border-surface-800 rounded-xl p-4 text-center">
          <div className="text-3xl font-bold text-amber-400">{testResults.errors || 0}</div>
          <div className="text-xs text-surface-500 mt-1">Errors</div>
        </div>
      </div>

      {/* Output log */}
      {testResults.output && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-surface-400 uppercase tracking-wider">Test Output</h3>
          <pre className="bg-surface-950 border border-surface-800 rounded-xl p-4 text-xs font-mono text-surface-400 overflow-x-auto max-h-[500px] overflow-y-auto leading-relaxed whitespace-pre-wrap">
            {testResults.output}
          </pre>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div className="bg-surface-900/50 border border-surface-800 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={14} className={color} />
        <span className="text-xs text-surface-500">{label}</span>
      </div>
      <div className="text-2xl font-bold text-surface-200">{value}</div>
    </div>
  );
}

function StatusBadge({ status }) {
  const configs = {
    pending: 'bg-surface-700 text-surface-400',
    planning: 'bg-blue-900/30 text-blue-400',
    building: 'bg-amber-900/30 text-amber-400',
    testing: 'bg-purple-900/30 text-purple-400',
    retrying: 'bg-orange-900/30 text-orange-400',
    deploying: 'bg-cyan-900/30 text-cyan-400',
    completed: 'bg-emerald-900/30 text-emerald-400',
    failed: 'bg-red-900/30 text-red-400',
    cancelled: 'bg-surface-800 text-surface-500',
  };

  return (
    <span className={`text-xs font-medium px-3 py-1.5 rounded-full capitalize ${configs[status] || configs.pending}`}>
      {status}
    </span>
  );
}

function MethodBadge({ method }) {
  const colors = {
    GET: 'text-emerald-400 bg-emerald-900/30',
    POST: 'text-blue-400 bg-blue-900/30',
    PUT: 'text-amber-400 bg-amber-900/30',
    PATCH: 'text-orange-400 bg-orange-900/30',
    DELETE: 'text-red-400 bg-red-900/30',
  };

  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded font-mono ${colors[method] || 'text-surface-400 bg-surface-700'}`}>
      {method}
    </span>
  );
}

function safeJsonParse(str) {
  if (!str) return null;
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}