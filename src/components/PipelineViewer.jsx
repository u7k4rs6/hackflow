import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  ClipboardList,
  Hammer,
  TestTube2,
  RefreshCw,
  Github,
  Rocket,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  SkipForward,
} from 'lucide-react';
import { api } from '../api';

const STAGE_DEFS = [
  { key: 'planning', label: 'Planning', icon: ClipboardList, description: 'Analyzing idea into models and endpoints' },
  { key: 'building', label: 'Building', icon: Hammer, description: 'Generating FastAPI application code' },
  { key: 'testing', label: 'Testing', icon: TestTube2, description: 'Running automated test suite' },
  { key: 'retrying', label: 'Retrying', icon: RefreshCw, description: 'Fixing code and re-running tests' },
  { key: 'github', label: 'GitHub', icon: Github, description: 'Pushing code to repository' },
  { key: 'deploy', label: 'Deploy', icon: Rocket, description: 'Deploying to production' },
];

const STATUS_ICONS = {
  pending: { icon: Clock, className: 'text-surface-600' },
  started: { icon: Loader2, className: 'text-blue-400 animate-spin' },
  running: { icon: Loader2, className: 'text-blue-400 animate-spin' },
  completed: { icon: CheckCircle2, className: 'text-emerald-400' },
  passed: { icon: CheckCircle2, className: 'text-emerald-400' },
  success: { icon: CheckCircle2, className: 'text-emerald-400' },
  executed: { icon: CheckCircle2, className: 'text-blue-400' },
  rebuilt: { icon: CheckCircle2, className: 'text-amber-400' },
  retested: { icon: CheckCircle2, className: 'text-amber-400' },
  failed: { icon: XCircle, className: 'text-red-400' },
  skipped: { icon: SkipForward, className: 'text-surface-600' },
  error: { icon: XCircle, className: 'text-red-400' },
};

export default function PipelineViewer({ projectId, onComplete }) {
  const [data, setData] = useState(null);
  const [logs, setLogs] = useState([]);
  const logEndRef = useRef(null);
  const pollRef = useRef(null);

  const poll = useCallback(async () => {
    try {
      const status = await api.getPipelineStatus(projectId);
      setData(status);

      if (status.logs) {
        setLogs(status.logs);
      }

      if (['completed', 'failed', 'cancelled'].includes(status.status)) {
        clearInterval(pollRef.current);
        if (status.status === 'completed' && onComplete) {
          setTimeout(onComplete, 2000);
        }
      }
    } catch {
      // Silent
    }
  }, [projectId, onComplete]);

  useEffect(() => {
    poll();
    pollRef.current = setInterval(poll, 2000);
    return () => clearInterval(pollRef.current);
  }, [poll]);

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  if (!data) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={24} className="animate-spin text-surface-500" />
      </div>
    );
  }

  const currentStageIndex = getCurrentStageIndex(data.status);

  return (
    <div className="space-y-6">
      {/* Stage Progress */}
      <div className="bg-surface-900/50 border border-surface-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-semibold text-surface-200">Pipeline Progress</h2>
          <StatusLabel status={data.status} />
        </div>

        <div className="space-y-3">
          {STAGE_DEFS.map((stage, i) => {
            const stageData = data.stages?.[stage.key];
            const stageStatus = stageData?.status || 'pending';
            const isActive = getActiveForStage(stage.key, data.status);
            const statusConfig = STATUS_ICONS[stageStatus] || STATUS_ICONS.pending;
            const StageIcon = stage.icon;
            const StatusIcon = statusConfig.icon;

            return (
              <div
                key={stage.key}
                className={`flex items-center gap-4 p-3 rounded-lg transition-all ${
                  isActive
                    ? 'bg-blue-600/10 border border-blue-500/20 pipeline-pulse'
                    : stageStatus === 'completed' || stageStatus === 'passed' || stageStatus === 'success'
                    ? 'bg-emerald-600/5 border border-transparent'
                    : stageStatus === 'failed' || stageStatus === 'error'
                    ? 'bg-red-600/5 border border-red-500/10'
                    : 'border border-transparent opacity-50'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-surface-800 flex items-center justify-center shrink-0">
                  <StageIcon size={16} className={isActive ? 'text-blue-400' : 'text-surface-500'} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-surface-200">{stage.label}</div>
                  <div className="text-xs text-surface-500 truncate">
                    {stageData?.message || stage.description}
                  </div>
                </div>

                <StatusIcon size={18} className={statusConfig.className} />
              </div>
            );
          })}
        </div>
      </div>

      {/* Live Log */}
      <div className="bg-surface-900/50 border border-surface-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-surface-800 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-surface-400">Pipeline Log</h3>
          <span className="text-xs text-surface-600">{logs.length} entries</span>
        </div>
        <div className="max-h-80 overflow-y-auto p-4 space-y-1.5">
          {logs.map((log, i) => (
            <LogEntry key={i} log={log} />
          ))}
          {logs.length === 0 && (
            <div className="text-xs text-surface-600 flex items-center gap-2">
              <Loader2 size={12} className="animate-spin" />
              Waiting for pipeline to start...
            </div>
          )}
          <div ref={logEndRef} />
        </div>
      </div>

      {/* Result Summary */}
      {data.status === 'completed' && (
        <div className="bg-emerald-950/30 border border-emerald-800/40 rounded-xl p-6 text-center space-y-2">
          <CheckCircle2 size={32} className="text-emerald-400 mx-auto" />
          <h3 className="text-lg font-semibold text-emerald-300">Pipeline Complete</h3>
          <p className="text-sm text-emerald-400/70">
            Application generated and tested successfully. Redirecting to project details...
          </p>
        </div>
      )}

      {data.status === 'failed' && (
        <div className="bg-red-950/30 border border-red-800/40 rounded-xl p-6 text-center space-y-2">
          <XCircle size={32} className="text-red-400 mx-auto" />
          <h3 className="text-lg font-semibold text-red-300">Pipeline Failed</h3>
          <p className="text-sm text-red-400/70">{data.error || 'An unexpected error occurred.'}</p>
        </div>
      )}
    </div>
  );
}

function LogEntry({ log }) {
  const stageColors = {
    planning: 'text-blue-400',
    building: 'text-amber-400',
    testing: 'text-purple-400',
    retrying: 'text-orange-400',
    github: 'text-surface-300',
    deploy: 'text-cyan-400',
    completed: 'text-emerald-400',
    pipeline: 'text-red-400',
  };

  const statusIndicators = {
    started: 'bg-blue-400',
    running: 'bg-blue-400',
    completed: 'bg-emerald-400',
    passed: 'bg-emerald-400',
    success: 'bg-emerald-400',
    executed: 'bg-blue-400',
    rebuilt: 'bg-amber-400',
    retested: 'bg-amber-400',
    failed: 'bg-red-400',
    skipped: 'bg-surface-600',
    error: 'bg-red-400',
  };

  return (
    <div className="flex items-start gap-2.5 text-xs font-mono">
      <span className="text-surface-700 shrink-0 w-16">
        {formatLogTime(log.created_at)}
      </span>
      <span
        className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${statusIndicators[log.status] || 'bg-surface-600'}`}
      />
      <span className={`shrink-0 w-16 ${stageColors[log.stage] || 'text-surface-500'}`}>
        {log.stage}
      </span>
      <span className="text-surface-400">{log.message}</span>
    </div>
  );
}

function StatusLabel({ status }) {
  const configs = {
    pending: { label: 'Queued', className: 'bg-surface-700 text-surface-400' },
    planning: { label: 'Planning...', className: 'bg-blue-900/30 text-blue-400' },
    building: { label: 'Building...', className: 'bg-amber-900/30 text-amber-400' },
    testing: { label: 'Testing...', className: 'bg-purple-900/30 text-purple-400' },
    retrying: { label: 'Retrying...', className: 'bg-orange-900/30 text-orange-400' },
    deploying: { label: 'Deploying...', className: 'bg-cyan-900/30 text-cyan-400' },
    completed: { label: 'Complete', className: 'bg-emerald-900/30 text-emerald-400' },
    failed: { label: 'Failed', className: 'bg-red-900/30 text-red-400' },
    cancelled: { label: 'Cancelled', className: 'bg-surface-800 text-surface-500' },
  };

  const config = configs[status] || configs.pending;

  return (
    <span className={`text-xs font-medium px-3 py-1 rounded-full ${config.className}`}>
      {config.label}
    </span>
  );
}

function getCurrentStageIndex(status) {
  const map = { planning: 0, building: 1, testing: 2, retrying: 3, deploying: 4, completed: 5, failed: -1 };
  return map[status] ?? -1;
}

function getActiveForStage(stageKey, pipelineStatus) {
  const map = {
    planning: 'planning',
    building: 'building',
    testing: 'testing',
    retrying: 'retrying',
    github: 'deploying',
    deploy: 'deploying',
  };
  return map[stageKey] === pipelineStatus;
}

function formatLogTime(dateStr) {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr + 'Z');
    return date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return '';
  }
}