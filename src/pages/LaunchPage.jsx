import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Rocket, Zap, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';
import { api } from '../api';
import PipelineViewer from '../components/PipelineViewer';

const EXAMPLE_IDEAS = [
  'Build a task management app with user authentication, project boards, and task assignments',
  'Create a customer feedback tracker with categories, voting, and status updates',
  'Build an inventory management system with products, categories, and stock tracking',
  'Create a simple blog platform with posts, categories, comments, and user accounts',
  'Build a recipe sharing app with ingredients, steps, ratings, and user profiles',
];

export default function LaunchPage() {
  const [idea, setIdea] = useState('');
  const [launching, setLaunching] = useState(false);
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [error, setError] = useState(null);
  const [ready, setReady] = useState(null);
  const textareaRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.getSettingsStatus()
      .then((data) => setReady(data.ready))
      .catch(() => setReady(false));
  }, []);

  async function handleLaunch() {
    if (!idea.trim() || launching) return;
    setError(null);
    setLaunching(true);

    try {
      const result = await api.runPipeline(idea.trim());
      setActiveProjectId(result.projectId);
    } catch (err) {
      setError(err.message);
      setLaunching(false);
    }
  }

  function handleExampleClick(example) {
    setIdea(example);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }

  function handlePipelineComplete() {
    if (activeProjectId) {
      navigate(`/projects/${activeProjectId}`);
    }
  }

  function handleReset() {
    setActiveProjectId(null);
    setLaunching(false);
    setIdea('');
    setError(null);
  }

  if (activeProjectId) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Pipeline Executing</h1>
          <button
            onClick={handleReset}
            className="text-sm text-surface-400 hover:text-surface-200 transition-colors"
          >
            Launch another
          </button>
        </div>
        <PipelineViewer
          projectId={activeProjectId}
          onComplete={handlePipelineComplete}
        />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-10">
      <div className="text-center space-y-4 pt-8">
        <div className="inline-flex items-center gap-2 bg-blue-600/10 border border-blue-500/20 rounded-full px-4 py-1.5 text-xs text-blue-400 font-medium">
          <Zap size={14} />
          AI-Native Software Execution
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
          Describe it.{' '}
          <span className="text-blue-400 glow-text">Ship it.</span>
        </h1>
        <p className="text-surface-400 text-lg max-w-xl mx-auto">
          Enter a product idea. AutoShip plans, builds, tests, and deploys a
          working CRUD application autonomously.
        </p>
      </div>

      <div className="space-y-4">
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                handleLaunch();
              }
            }}
            placeholder="Describe the app you want to build..."
            rows={4}
            className="w-full bg-surface-900 border border-surface-700 rounded-xl px-5 py-4 text-surface-100 placeholder-surface-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 resize-none text-base transition-all"
            disabled={launching}
          />
          <div className="absolute bottom-3 right-3 text-xs text-surface-600">
            {idea.length > 0 && `${idea.length} chars`}
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-3 bg-red-950/40 border border-red-800/50 rounded-lg px-4 py-3 text-sm text-red-300">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {ready === false && (
          <div className="flex items-start gap-3 bg-amber-950/40 border border-amber-800/50 rounded-lg px-4 py-3 text-sm text-amber-300">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <span>
              OpenAI API key not configured.{' '}
              <a href="/settings" className="underline hover:text-amber-200">
                Add it in Settings
              </a>{' '}
              before launching.
            </span>
          </div>
        )}

        <button
          onClick={handleLaunch}
          disabled={!idea.trim() || launching || ready === false}
          className="w-full flex items-center justify-center gap-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-surface-700 disabled:text-surface-500 text-white font-semibold py-3.5 rounded-xl transition-all text-base"
        >
          {launching ? (
            <>
              <Loader2 size={20} className="animate-spin" />
              Initializing Pipeline...
            </>
          ) : (
            <>
              <Rocket size={20} />
              Launch Build
              <span className="text-xs text-blue-200 ml-1 hidden sm:inline">
                Ctrl+Enter
              </span>
            </>
          )}
        </button>
      </div>

      <div className="space-y-3">
        <h3 className="text-xs font-semibold text-surface-500 uppercase tracking-wider">
          Example ideas
        </h3>
        <div className="grid gap-2">
          {EXAMPLE_IDEAS.map((example, i) => (
            <button
              key={i}
              onClick={() => handleExampleClick(example)}
              className="text-left flex items-center gap-3 bg-surface-900/50 hover:bg-surface-800/80 border border-surface-800 hover:border-surface-700 rounded-lg px-4 py-3 text-sm text-surface-300 hover:text-surface-100 transition-all group"
            >
              <ArrowRight
                size={14}
                className="text-surface-600 group-hover:text-blue-400 transition-colors shrink-0"
              />
              <span>{example}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 pt-4">
        <InfoCard
          number="01"
          label="Plan"
          desc="AI analyzes idea into models, endpoints, and features"
        />
        <InfoCard
          number="02"
          label="Build"
          desc="Generates complete FastAPI + SQLite application code"
        />
        <InfoCard
          number="03"
          label="Ship"
          desc="Runs tests, pushes to GitHub, and deploys automatically"
        />
      </div>
    </div>
  );
}

function InfoCard({ number, label, desc }) {
  return (
    <div className="bg-surface-900/30 border border-surface-800 rounded-xl p-5 space-y-2">
      <div className="text-xs font-mono text-blue-500">{number}</div>
      <div className="font-semibold text-surface-200">{label}</div>
      <div className="text-xs text-surface-500 leading-relaxed">{desc}</div>
    </div>
  );
}