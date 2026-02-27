import React, { useState, useEffect } from 'react';
import {
  Settings,
  Key,
  Save,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { api } from '../api';

export default function SettingsPage() {
  const [settings, setSettings] = useState({});
  const [status, setStatus] = useState(null);
  const [envOverrides, setEnvOverrides] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState(null);
  const [healthOk, setHealthOk] = useState(null);

  useEffect(() => {
    loadSettings();
    checkHealth();
  }, []);

  async function loadSettings() {
    try {
      const [settingsData, statusData] = await Promise.all([
        api.getSettings(),
        api.getSettingsStatus(),
      ]);
      setSettings(settingsData.settings || {});
      setEnvOverrides(settingsData.envOverrides || {});
      setStatus(statusData);
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  }

  async function checkHealth() {
    try {
      await api.healthCheck();
      setHealthOk(true);
    } catch {
      setHealthOk(false);
    }
  }

  async function handleSave(key, value) {
    setSaving(true);
    setSaveMessage(null);

    try {
      await api.updateSettings({ [key]: value });
      setSaveMessage({ type: 'success', text: `Saved ${key}` });
      await loadSettings();
    } catch (err) {
      setSaveMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMessage(null), 3000);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-surface-500" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="flex items-center gap-3">
        <Settings size={24} className="text-surface-400" />
        <h1 className="text-2xl font-bold">Settings</h1>
      </div>

      {/* Health Status */}
      <div className="bg-surface-900/50 border border-surface-800 rounded-xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${healthOk ? 'bg-emerald-400' : 'bg-red-400'}`} />
          <span className="text-sm text-surface-300">
            Backend: {healthOk ? 'Connected' : 'Disconnected'}
          </span>
        </div>
        <button
          onClick={checkHealth}
          className="text-surface-500 hover:text-surface-300 transition-colors"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Integration Status */}
      {status && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-surface-400 uppercase tracking-wider">
            Integration Status
          </h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {Object.entries(status).filter(([k]) => k !== 'ready').map(([key, info]) => (
              <div
                key={key}
                className="bg-surface-900/50 border border-surface-800 rounded-xl p-4 flex items-start gap-3"
              >
                {info.configured ? (
                  <CheckCircle2 size={18} className="text-emerald-400 mt-0.5" />
                ) : (
                  <XCircle size={18} className={`mt-0.5 ${info.required ? 'text-red-400' : 'text-surface-600'}`} />
                )}
                <div>
                  <div className="font-medium text-surface-200 capitalize text-sm">{key}</div>
                  {info.description && (
                    <div className="text-xs text-surface-500 mt-0.5">{info.description}</div>
                  )}
                  <div className="text-xs mt-1">
                    {info.configured ? (
                      <span className="text-emerald-400">Configured</span>
                    ) : info.required ? (
                      <span className="text-red-400">Required — not set</span>
                    ) : (
                      <span className="text-surface-600">Optional — not set</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {saveMessage && (
        <div
          className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm ${
            saveMessage.type === 'success'
              ? 'bg-emerald-950/40 border border-emerald-800/50 text-emerald-300'
              : 'bg-red-950/40 border border-red-800/50 text-red-300'
          }`}
        >
          {saveMessage.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {saveMessage.text}
        </div>
      )}

      {/* API Keys */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-surface-400 uppercase tracking-wider">
          API Keys
        </h2>

        <SettingInput
          label="OpenAI API Key"
          settingKey="openai_api_key"
          placeholder="sk-..."
          type="password"
          current={settings.openai_api_key}
          envOverride={envOverrides.openai_api_key}
          onSave={handleSave}
          saving={saving}
          required
        />

        <SettingInput
          label="GitHub Token"
          settingKey="github_token"
          placeholder="ghp_..."
          type="password"
          current={settings.github_token}
          envOverride={envOverrides.github_token}
          onSave={handleSave}
          saving={saving}
          hint="For auto-creating repos. Needs 'repo' scope."
        />

        <SettingInput
          label="Railway Token"
          settingKey="railway_token"
          placeholder="railway-token..."
          type="password"
          current={settings.railway_token}
          envOverride={envOverrides.railway_token}
          onSave={handleSave}
          saving={saving}
          hint="For auto-deploying to Railway."
        />

        <SettingInput
          label="Render API Key"
          settingKey="render_api_key"
          placeholder="rnd_..."
          type="password"
          current={settings.render_api_key}
          envOverride={envOverrides.render_api_key}
          onSave={handleSave}
          saving={saving}
          hint="For auto-deploying to Render."
        />
      </div>

      {/* Configuration */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-surface-400 uppercase tracking-wider">
          Configuration
        </h2>

        <SettingInput
          label="OpenAI Model"
          settingKey="openai_model"
          placeholder="gpt-4o"
          current={settings.openai_model}
          onSave={handleSave}
          saving={saving}
          hint="gpt-4o recommended. gpt-3.5-turbo for faster/cheaper runs."
        />

        <SettingInput
          label="Test Pass Threshold (%)"
          settingKey="test_threshold"
          placeholder="80"
          current={settings.test_threshold}
          onSave={handleSave}
          saving={saving}
          hint="Minimum test pass percentage to allow deployment."
        />

        <SettingInput
          label="Max Retries"
          settingKey="max_retries"
          placeholder="1"
          current={settings.max_retries}
          onSave={handleSave}
          saving={saving}
          hint="How many times to retry if tests fail. Keep at 1 for MVP."
        />
      </div>
    </div>
  );
}

function SettingInput({ label, settingKey, placeholder, type = 'text', current, envOverride, onSave, saving, hint, required }) {
  const [value, setValue] = useState('');
  const [edited, setEdited] = useState(false);

  function handleChange(e) {
    setValue(e.target.value);
    setEdited(true);
  }

  function handleSave() {
    if (value.trim()) {
      onSave(settingKey, value.trim());
      setEdited(false);
      setValue('');
    }
  }

  return (
    <div className="bg-surface-900/50 border border-surface-800 rounded-xl p-4 space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-surface-300 flex items-center gap-2">
          <Key size={14} className="text-surface-500" />
          {label}
          {required && <span className="text-red-400 text-xs">required</span>}
        </label>
        {envOverride && (
          <span className="text-[10px] bg-emerald-900/30 text-emerald-400 px-2 py-0.5 rounded-full">
            env override active
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <input
          type={type}
          value={value}
          onChange={handleChange}
          placeholder={current || placeholder}
          className="flex-1 bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm text-surface-200 placeholder-surface-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all font-mono"
        />
        <button
          onClick={handleSave}
          disabled={!edited || saving || !value.trim()}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-surface-700 disabled:text-surface-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-all"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Save
        </button>
      </div>

      {hint && <p className="text-xs text-surface-600">{hint}</p>}
    </div>
  );
}