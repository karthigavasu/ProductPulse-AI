import React, { useState } from 'react';
import { Bot, Send } from 'lucide-react';
import { api } from '../lib/api';

const TASKS = [
  { id: 'summarize_feedback', label: 'Summarize Customer Feedback' },
  { id: 'explain_analytics', label: 'Explain Product Analytics' },
  { id: 'suggest_improvements', label: 'Suggest Feature Improvements' },
  { id: 'draft_prd', label: 'Draft PRD Outline' },
  { id: 'generate_user_stories', label: 'Generate User Stories' },
  { id: 'explain_rice', label: 'Explain RICE Rankings' },
  { id: 'summarize_experiment', label: 'Summarize Experiment Results' },
  { id: 'general', label: 'General Product Question' },
];

interface AssistantTurn {
  id: number;
  taskLabel: string;
  prompt: string;
  mode: string;
  modelLabel: string;
  answer: string;
}

interface AiAssistantModuleProps {
  geminiConfigured: boolean;
}

export const AiAssistantModule: React.FC<AiAssistantModuleProps> = ({
  geminiConfigured,
}) => {
  const [task, setTask] = useState('summarize_feedback');
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [turns, setTurns] = useState<AssistantTurn[]>([]);

  const handleRun = async (e?: React.FormEvent, customTask?: string, customPrompt?: string) => {
    e?.preventDefault();
    const activeTask = customTask ?? task;
    const activePrompt = customPrompt ?? prompt;
    setLoading(true);
    setError('');

    try {
      const res = await api.queryAssistant(activeTask, activePrompt);
      const taskLabel =
        TASKS.find((t) => t.id === activeTask)?.label ?? 'General Briefing';
      setTurns((prev) => [
        {
          id: Date.now(),
          taskLabel,
          prompt: activePrompt || `Run ${taskLabel}`,
          mode: res.mode,
          modelLabel: res.modelLabel,
          answer: res.answer,
        },
        ...prev,
      ]);
      if (!customPrompt) setPrompt('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Assistant request failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            AI Product Assistant
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Grounded directly in live SQLite analytics, feedback clusters, RICE rankings, and A/B experiments ·{' '}
            <span className="font-semibold text-purple-700">
              Active Engine: {geminiConfigured ? 'Gemini 4 Hydrogen' : 'Local Analytical Fallback'}
            </span>
          </p>
        </div>
      </div>

      {/* Quick Action Prompts */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <div className="flex flex-wrap gap-2">
          {TASKS.slice(0, 7).map((t) => (
            <button
              key={t.id}
              type="button"
              disabled={loading}
              onClick={() => {
                setTask(t.id);
                void handleRun(undefined, t.id, t.label);
              }}
              className={`whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                task === t.id
                  ? 'border-purple-600 bg-purple-50 text-purple-800'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <form onSubmit={(e) => void handleRun(e)} className="flex flex-col gap-3 sm:flex-row">
          <select
            aria-label="Assistant task type"
            value={task}
            onChange={(e) => setTask(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700"
          >
            {TASKS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>

          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ask a product question, specify a PRD topic, or press Run..."
            className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-purple-600 focus:outline-none"
          />

          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-purple-600 px-4 py-2 text-xs font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
          >
            <Send className="h-3.5 w-3.5" />
            {loading ? 'Analyzing...' : 'Run Assistant'}
          </button>
        </form>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
            {error}
          </div>
        )}
      </div>

      {/* Responses Feed */}
      <div className="space-y-4">
        {turns.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
            <Bot className="mx-auto h-8 w-8 text-purple-600" />
            <h2 className="mt-3 text-sm font-semibold text-slate-900">
              Ready to synthesize workspace intelligence
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Click any quick-task button above or ask a custom question to summarize feedback, explain RICE rankings, or draft PRDs.
            </p>
          </div>
        ) : (
          turns.map((turn) => (
            <div
              key={turn.id}
              className="rounded-xl border border-slate-200 bg-white p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 text-xs text-slate-500">
                <div className="font-semibold text-slate-900">
                  {turn.taskLabel} · {turn.prompt}
                </div>
                <div className="font-mono text-[11px] text-purple-700">
                  {turn.modelLabel}
                </div>
              </div>
              <pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-700">
                {turn.answer}
              </pre>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
