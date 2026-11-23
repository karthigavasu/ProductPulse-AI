import React, { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Edit3, Plus, SlidersHorizontal } from 'lucide-react';
import { api } from '../lib/api';
import type { AuthUser, MoscowPriority, ProductFeature } from '../types/productpulse';

interface PrioritizationModuleProps {
  currentUser: AuthUser | null;
  onRequireAuth: () => void;
  prefill?: { title: string; description: string } | null;
  onClearPrefill?: () => void;
}

export const PrioritizationModule: React.FC<PrioritizationModuleProps> = ({
  currentUser,
  onRequireAuth,
  prefill,
  onClearPrefill,
}) => {
  const [features, setFeatures] = useState<ProductFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(Boolean(prefill));
  const [editingOverride, setEditingOverride] = useState<ProductFeature | null>(null);

  // Create form state
  const [title, setTitle] = useState(prefill?.title ?? '');
  const [description, setDescription] = useState(prefill?.description ?? '');
  const [category, setCategory] = useState('Core Product');
  const [reach, setReach] = useState('1500');
  const [impact, setImpact] = useState('2');
  const [confidence, setConfidence] = useState('80');
  const [effort, setEffort] = useState('1.5');
  const [moscow, setMoscow] = useState<MoscowPriority>('Should Have');
  const [initiative, setInitiative] = useState('Core Platform');
  const [targetReleaseDate, setTargetReleaseDate] = useState('2027-01-30');
  const [milestone, setMilestone] = useState('Q1 Core Drop');

  // Override modal state
  const [overrideRank, setOverrideRank] = useState('');
  const [overrideReason, setOverrideReason] = useState('');

  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (prefill) {
      setTitle(prefill.title);
      setDescription(prefill.description);
      setShowCreate(true);
    }
  }, [prefill]);

  const loadFeatures = async () => {
    setLoading(true);
    try {
      const list = await api.getFeatures();
      setFeatures(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load features.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadFeatures();
  }, []);

  const previewRice = (() => {
    const r = Number(reach);
    const i = Number(impact);
    const c = Number(confidence);
    const e = Number(effort);
    if (!r || !i || !c || !e || e <= 0) return 0;
    return Math.round(((r * i * (c / 100)) / e) * 100) / 100;
  })();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      onRequireAuth();
      return;
    }
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const created = await api.createFeature({
        title,
        description,
        category,
        reach: Number(reach),
        impact: Number(impact),
        confidence: Number(confidence),
        effort: Number(effort),
        moscowPriority: moscow,
        initiative,
        targetReleaseDate,
        milestone,
      });
      setTitle('');
      setDescription('');
      setShowCreate(false);
      onClearPrefill?.();
      setNotice(`Added "${created.title}" with calculated RICE score ${created.riceScore}.`);
      await loadFeatures();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create proposal.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingOverride) return;
    if (!currentUser) {
      onRequireAuth();
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.updateFeature(editingOverride.id, {
        manualPriorityOverride: overrideRank.trim() === '' ? null : Number(overrideRank),
        overrideReason: overrideReason.trim(),
      });
      setEditingOverride(null);
      setNotice('Updated manual priority override and recorded audit trail.');
      await loadFeatures();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Override update failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleInlineRiceUpdate = async (
    f: ProductFeature,
    patch: Partial<{ reach: number; impact: number; confidence: number; effort: number }>
  ) => {
    if (!currentUser) {
      onRequireAuth();
      return;
    }
    try {
      await api.updateFeature(f.id, patch);
      await loadFeatures();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update RICE inputs.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Feature Prioritization Engine (RICE)
          </h1>
          <p className="mt-1 font-mono text-xs text-slate-500">
            RICE Score = (Reach × Impact × Confidence%) / Effort (person-months)
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            if (!currentUser) onRequireAuth();
            else setShowCreate((v) => !v);
          }}
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700"
        >
          <Plus className="h-3.5 w-3.5" />
          New Feature Proposal
        </button>
      </div>

      {notice && (
        <div className="rounded-lg border border-teal-200 bg-teal-50 px-4 py-2.5 text-xs font-medium text-teal-900">
          {notice}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-medium text-red-800">
          {error}
        </div>
      )}

      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="rounded-xl border border-slate-200 bg-white p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Create Feature Proposal & Calculate RICE
              </h2>
              <p className="text-xs text-slate-500">
                Live Preview RICE Score:{' '}
                <span className="font-mono font-semibold text-blue-700 tabular-nums">
                  {previewRice.toLocaleString()}
                </span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowCreate(false);
                onClearPrefill?.();
              }}
              className="text-xs text-slate-500 hover:text-slate-800"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="text-xs font-medium text-slate-700 md:col-span-2">
              Feature Title
              <input
                type="text"
                required
                minLength={3}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Scheduled Weekly Stakeholder Digest"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs font-medium text-slate-700">
              Category
              <input
                type="text"
                required
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
          </div>

          <label className="block text-xs font-medium text-slate-700">
            Description & Customer Value
            <textarea
              required
              minLength={3}
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
            <label className="text-xs font-medium text-slate-700">
              Reach (users/qtr)
              <input
                type="number"
                min={0}
                required
                value={reach}
                onChange={(e) => setReach(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 font-mono text-xs"
              />
            </label>
            <label className="text-xs font-medium text-slate-700">
              Impact (0.25–3)
              <select
                value={impact}
                onChange={(e) => setImpact(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 font-mono text-xs"
              >
                <option value="3">3.0 Massive</option>
                <option value="2">2.0 High</option>
                <option value="1">1.0 Medium</option>
                <option value="0.5">0.5 Low</option>
                <option value="0.25">0.25 Minimal</option>
              </select>
            </label>
            <label className="text-xs font-medium text-slate-700">
              Confidence (%)
              <input
                type="number"
                min={1}
                max={100}
                required
                value={confidence}
                onChange={(e) => setConfidence(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 font-mono text-xs"
              />
            </label>
            <label className="text-xs font-medium text-slate-700">
              Effort (person-mo)
              <input
                type="number"
                step="0.1"
                min={0.1}
                required
                value={effort}
                onChange={(e) => setEffort(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 font-mono text-xs"
              />
            </label>
            <label className="text-xs font-medium text-slate-700">
              MoSCoW
              <select
                value={moscow}
                onChange={(e) => setMoscow(e.target.value as MoscowPriority)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs"
              >
                <option value="Must Have">Must Have</option>
                <option value="Should Have">Should Have</option>
                <option value="Could Have">Could Have</option>
                <option value="Won't Have">Won't Have</option>
              </select>
            </label>
            <label className="text-xs font-medium text-slate-700">
              Target Date
              <input
                type="date"
                value={targetReleaseDate}
                onChange={(e) => setTargetReleaseDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 font-mono text-xs"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="text-xs font-medium text-slate-700">
              Initiative
              <input
                type="text"
                value={initiative}
                onChange={(e) => setInitiative(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs"
              />
            </label>
            <label className="text-xs font-medium text-slate-700">
              Release Milestone
              <input
                type="text"
                value={milestone}
                onChange={(e) => setMilestone(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs"
              />
            </label>
            <div className="flex items-end justify-end">
              <button
                type="submit"
                disabled={saving}
                className="whitespace-nowrap rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Calculating & Saving...' : 'Save Feature Proposal'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Override Dialog */}
      {editingOverride && (
        <form
          onSubmit={handleSaveOverride}
          className="rounded-xl border border-purple-200 bg-purple-50/50 p-5 space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-purple-700" />
              <h2 className="text-sm font-semibold text-slate-900">
                Manual Priority Override: {editingOverride.title}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setEditingOverride(null)}
              className="text-xs text-slate-600 hover:text-slate-900"
            >
              Close
            </button>
          </div>
          <p className="text-xs text-slate-600">
            Original calculated RICE score ({editingOverride.riceScore}) remains preserved for transparency. Leave Rank blank to clear override.
          </p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <label className="text-xs font-medium text-slate-700">
              Override Rank (1 = top)
              <input
                type="number"
                min={1}
                max={100}
                value={overrideRank}
                onChange={(e) => setOverrideRank(e.target.value)}
                placeholder="e.g. 1"
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-mono text-xs"
              />
            </label>
            <label className="text-xs font-medium text-slate-700 md:col-span-3">
              Mandatory Justification (Audited)
              <input
                type="text"
                required={overrideRank.trim() !== ''}
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                placeholder="e.g. Contractual commitment for Q4 enterprise launch"
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs"
              />
            </label>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-purple-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-purple-700"
            >
              Save Priority Override
            </button>
          </div>
        </form>
      )}

      {/* Comparison Chart */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-base font-semibold text-slate-900">
          RICE Score Comparison Across Proposals
        </h2>
        <p className="mb-4 text-xs text-slate-500">
          Objective quantitative ranking before manual executive overrides
        </p>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={[...features].sort((a, b) => b.riceScore - a.riceScore)}
              margin={{ top: 8, right: 16, left: 0, bottom: 24 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis
                dataKey="title"
                tick={{ fontSize: 10, fill: '#475569' }}
                tickFormatter={(v: string) =>
                  v.length > 20 ? `${v.slice(0, 18)}…` : v
                }
              />
              <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
              <Tooltip />
              <Bar dataKey="riceScore" name="RICE Score" fill="#2563EB" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Prioritization Matrix Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-3.5">
          <h2 className="text-sm font-semibold text-slate-900">
            Ranked Feature Proposals ({features.length})
          </h2>
        </div>
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500">
            Loading feature proposals...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Rank</th>
                  <th className="px-4 py-2.5 font-medium">Feature Proposal</th>
                  <th className="px-4 py-2.5 text-right font-medium">Reach</th>
                  <th className="px-4 py-2.5 text-right font-medium">Impact</th>
                  <th className="px-4 py-2.5 text-right font-medium">Conf %</th>
                  <th className="px-4 py-2.5 text-right font-medium">Effort (mo)</th>
                  <th className="px-4 py-2.5 text-right font-medium">RICE Score</th>
                  <th className="px-4 py-2.5 font-medium">MoSCoW / Status</th>
                  <th className="px-4 py-2.5 text-right font-medium">Override</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {features.map((f, index) => (
                  <tr key={f.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-mono font-semibold text-slate-700 tabular-nums">
                      #{index + 1}
                      {f.manualPriorityOverride !== null && (
                        <div className="text-[11px] font-normal text-purple-700">
                          Override #{f.manualPriorityOverride}
                        </div>
                      )}
                    </td>
                    <td className="max-w-sm px-4 py-3">
                      <div className="font-semibold text-slate-900">{f.title}</div>
                      <div className="mt-0.5 text-slate-500">{f.description}</div>
                      {f.overrideReason && (
                        <div className="mt-1 text-[11px] font-medium text-purple-700">
                          Override rationale: {f.overrideReason}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">
                      {f.reach.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">
                      <select
                        aria-label={`Impact for ${f.title}`}
                        value={String(f.impact)}
                        onChange={(e) =>
                          void handleInlineRiceUpdate(f, {
                            impact: Number(e.target.value),
                          })
                        }
                        className="rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-xs"
                      >
                        <option value="3">3</option>
                        <option value="2">2</option>
                        <option value="1">1</option>
                        <option value="0.5">0.5</option>
                        <option value="0.25">0.25</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">
                      {f.confidence}%
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">
                      {f.effort}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm font-semibold text-blue-700 tabular-nums">
                      {f.riceScore.toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{f.moscowPriority}</div>
                      <div className="text-slate-500">{f.roadmapStatus}</div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          if (!currentUser) {
                            onRequireAuth();
                            return;
                          }
                          setEditingOverride(f);
                          setOverrideRank(
                            f.manualPriorityOverride !== null
                              ? String(f.manualPriorityOverride)
                              : ''
                          );
                          setOverrideReason(f.overrideReason);
                        }}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                      >
                        <Edit3 className="h-3 w-3" />
                        Adjust
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
