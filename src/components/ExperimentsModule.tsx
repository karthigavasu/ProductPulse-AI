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
import { FlaskConical, Plus } from 'lucide-react';
import { api } from '../lib/api';
import type { AuthUser, Experiment, ExperimentStatus } from '../types/productpulse';

interface ExperimentsModuleProps {
  currentUser: AuthUser | null;
  onRequireAuth: () => void;
}

export const ExperimentsModule: React.FC<ExperimentsModuleProps> = ({
  currentUser,
  onRequireAuth,
}) => {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Create form
  const [name, setName] = useState('');
  const [hypothesis, setHypothesis] = useState('');
  const [metricName, setMetricName] = useState('Conversion Rate');
  const [controlVisitors, setControlVisitors] = useState('500');
  const [controlConversions, setControlConversions] = useState('45');
  const [variantVisitors, setVariantVisitors] = useState('500');
  const [variantConversions, setVariantConversions] = useState('62');

  // Edit observations state
  const [obsCVis, setObsCVis] = useState('');
  const [obsCConv, setObsCConv] = useState('');
  const [obsVVis, setObsVVis] = useState('');
  const [obsVConv, setObsVConv] = useState('');
  const [obsStatus, setObsStatus] = useState<ExperimentStatus>('Running');
  const [obsNotes, setObsNotes] = useState('');
  const [obsNextStep, setObsNextStep] = useState('');

  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadExperiments = async () => {
    setLoading(true);
    try {
      setExperiments(await api.getExperiments());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load experiments.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadExperiments();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      onRequireAuth();
      return;
    }
    setError('');
    try {
      await api.createExperiment({
        name,
        hypothesis,
        metricName,
        status: 'Running',
        controlVisitors: Number(controlVisitors),
        controlConversions: Number(controlConversions),
        variantVisitors: Number(variantVisitors),
        variantConversions: Number(variantConversions),
      });
      setName('');
      setHypothesis('');
      setShowCreate(false);
      setNotice('Created experiment and computed two-proportion z-test statistics.');
      await loadExperiments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Experiment creation failed.');
    }
  };

  const startEdit = (exp: Experiment) => {
    if (!currentUser) {
      onRequireAuth();
      return;
    }
    setEditingId(exp.id);
    setObsCVis(String(exp.controlVisitors));
    setObsCConv(String(exp.controlConversions));
    setObsVVis(String(exp.variantVisitors));
    setObsVConv(String(exp.variantConversions));
    setObsStatus(exp.status);
    setObsNotes(exp.outcomeNotes);
    setObsNextStep(exp.nextStepRecommendation);
  };

  const handleSaveObservations = async (e: React.FormEvent, id: number) => {
    e.preventDefault();
    setError('');
    try {
      await api.updateExperiment(id, {
        controlVisitors: Number(obsCVis),
        controlConversions: Number(obsCConv),
        variantVisitors: Number(obsVVis),
        variantConversions: Number(obsVConv),
        status: obsStatus,
        outcomeNotes: obsNotes,
        nextStepRecommendation: obsNextStep,
      });
      setEditingId(null);
      setNotice('Updated observations and recalculated statistical significance.');
      await loadExperiments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update observations.');
    }
  };

  const chartData = experiments.map((e) => ({
    name: e.name.length > 22 ? `${e.name.slice(0, 20)}…` : e.name,
    Control: e.statistics.controlRate,
    Variant: e.statistics.variantRate,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            A/B Testing & Experimentation
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Two-proportion z-test significance, 95% confidence intervals, and strict sample adequacy checks (never fabricates significance)
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
          New Experiment
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
          <h2 className="text-sm font-semibold text-slate-900">
            Create Controlled Experiment
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="text-xs font-medium text-slate-700">
              Experiment Name
              <input
                type="text"
                required
                minLength={3}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Inline RICE Formula Tooltip"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs font-medium text-slate-700">
              Primary Metric
              <input
                type="text"
                required
                value={metricName}
                onChange={(e) => setMetricName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
          </div>

          <label className="block text-xs font-medium text-slate-700">
            Hypothesis
            <textarea
              required
              minLength={5}
              rows={2}
              value={hypothesis}
              onChange={(e) => setHypothesis(e.target.value)}
              placeholder="If we [change], then [metric] will improve because [rationale]."
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <label className="text-xs font-medium text-slate-700">
              Control Visitors
              <input
                type="number"
                min={0}
                value={controlVisitors}
                onChange={(e) => setControlVisitors(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 font-mono text-xs"
              />
            </label>
            <label className="text-xs font-medium text-slate-700">
              Control Conversions
              <input
                type="number"
                min={0}
                value={controlConversions}
                onChange={(e) => setControlConversions(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 font-mono text-xs"
              />
            </label>
            <label className="text-xs font-medium text-slate-700">
              Variant Visitors
              <input
                type="number"
                min={0}
                value={variantVisitors}
                onChange={(e) => setVariantVisitors(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 font-mono text-xs"
              />
            </label>
            <label className="text-xs font-medium text-slate-700">
              Variant Conversions
              <input
                type="number"
                min={0}
                value={variantConversions}
                onChange={(e) => setVariantConversions(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 font-mono text-xs"
              />
            </label>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
            >
              Launch Experiment
            </button>
          </div>
        </form>
      )}

      {experiments.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-base font-semibold text-slate-900">
            Control vs Variant Conversion Rates (%)
          </h2>
          <p className="mb-4 text-xs text-slate-500">
            Blue: Control Arm · Teal: Variant Arm
          </p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#475569' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} unit="%" />
                <Tooltip />
                <Bar dataKey="Control" fill="#2563EB" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Variant" fill="#0D9488" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500">
            Loading experiments...
          </div>
        ) : (
          experiments.map((exp) => {
            const st = exp.statistics;
            return (
              <div
                key={exp.id}
                className="rounded-xl border border-slate-200 bg-white p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <FlaskConical className="h-3.5 w-3.5 text-purple-700" />
                      <span className="font-semibold text-slate-800">{exp.status}</span>
                      <span aria-hidden="true">·</span>
                      <span>Metric: {exp.metricName}</span>
                      {exp.isSynthetic && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-amber-700">Synthetic Demo</span>
                        </>
                      )}
                    </div>
                    <h3 className="mt-1 text-base font-semibold text-slate-900">
                      {exp.name}
                    </h3>
                    <p className="mt-1 text-xs text-slate-600">
                      <span className="font-medium text-slate-800">Hypothesis:</span>{' '}
                      {exp.hypothesis}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => startEdit(exp)}
                    className="whitespace-nowrap rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Record Observations
                  </button>
                </div>

                {/* Statistical Grid */}
                <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-5">
                  <div>
                    <div className="text-[11px] text-slate-500">{exp.controlName}</div>
                    <div className="mt-0.5 font-mono text-lg font-semibold text-slate-900 tabular-nums">
                      {st.controlRate}%
                    </div>
                    <div className="font-mono text-[11px] text-slate-500 tabular-nums">
                      {exp.controlConversions.toLocaleString()} /{' '}
                      {exp.controlVisitors.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-500">{exp.variantName}</div>
                    <div className="mt-0.5 font-mono text-lg font-semibold text-teal-700 tabular-nums">
                      {st.variantRate}%
                    </div>
                    <div className="font-mono text-[11px] text-slate-500 tabular-nums">
                      {exp.variantConversions.toLocaleString()} /{' '}
                      {exp.variantVisitors.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-500">Absolute Lift</div>
                    <div
                      className={`mt-0.5 font-mono text-lg font-semibold tabular-nums ${
                        st.absoluteLift >= 0 ? 'text-teal-700' : 'text-red-700'
                      }`}
                    >
                      {st.absoluteLift >= 0 ? '+' : ''}
                      {st.absoluteLift} pp
                    </div>
                    <div className="font-mono text-[11px] text-slate-500 tabular-nums">
                      {st.relativeLiftPct !== null
                        ? `Rel: ${st.relativeLiftPct >= 0 ? '+' : ''}${st.relativeLiftPct}%`
                        : 'Rel: N/A'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-500">P-Value & Z-Score</div>
                    <div className="mt-0.5 font-mono text-lg font-semibold text-slate-900 tabular-nums">
                      {st.pValue !== null ? `p = ${st.pValue}` : 'Insufficient N'}
                    </div>
                    <div className="font-mono text-[11px] text-slate-500 tabular-nums">
                      {st.zScore !== null ? `z = ${st.zScore}` : 'Test paused / low N'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-500">Significance Status</div>
                    <div
                      className={`mt-0.5 text-sm font-semibold ${
                        !st.sampleAdequate
                          ? 'text-amber-700'
                          : st.isSignificant
                          ? 'text-teal-700'
                          : 'text-slate-700'
                      }`}
                    >
                      {!st.sampleAdequate
                        ? 'Insufficient Sample'
                        : st.isSignificant
                        ? `Significant (${st.confidenceLevelPct}%)`
                        : 'Not Significant'}
                    </div>
                    {st.ci95Low !== null && st.ci95High !== null && (
                      <div className="font-mono text-[11px] text-slate-500 tabular-nums">
                        95% CI [{st.ci95Low}, {st.ci95High}] pp
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 space-y-1.5 rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
                  <div>
                    <span className="font-semibold text-slate-900">
                      Statistical Guidance:
                    </span>{' '}
                    {st.recommendation}
                  </div>
                  <div className="text-slate-500">
                    <span className="font-medium">Methodology Caveat:</span> {st.caveat}
                  </div>
                  {exp.outcomeNotes && (
                    <div>
                      <span className="font-medium text-slate-800">Outcome Notes:</span>{' '}
                      {exp.outcomeNotes}
                    </div>
                  )}
                  {exp.nextStepRecommendation && (
                    <div>
                      <span className="font-medium text-slate-800">Documented Next Step:</span>{' '}
                      {exp.nextStepRecommendation}
                    </div>
                  )}
                </div>

                {editingId === exp.id && (
                  <form
                    onSubmit={(e) => void handleSaveObservations(e, exp.id)}
                    className="mt-4 space-y-3 border-t border-slate-200 pt-4"
                  >
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                      <label className="text-xs font-medium text-slate-700">
                        Control Visitors
                        <input
                          type="number"
                          min={0}
                          value={obsCVis}
                          onChange={(e) => setObsCVis(e.target.value)}
                          className="mt-1 w-full rounded border border-slate-200 px-2 py-1 font-mono text-xs"
                        />
                      </label>
                      <label className="text-xs font-medium text-slate-700">
                        Control Conv.
                        <input
                          type="number"
                          min={0}
                          value={obsCConv}
                          onChange={(e) => setObsCConv(e.target.value)}
                          className="mt-1 w-full rounded border border-slate-200 px-2 py-1 font-mono text-xs"
                        />
                      </label>
                      <label className="text-xs font-medium text-slate-700">
                        Variant Visitors
                        <input
                          type="number"
                          min={0}
                          value={obsVVis}
                          onChange={(e) => setObsVVis(e.target.value)}
                          className="mt-1 w-full rounded border border-slate-200 px-2 py-1 font-mono text-xs"
                        />
                      </label>
                      <label className="text-xs font-medium text-slate-700">
                        Variant Conv.
                        <input
                          type="number"
                          min={0}
                          value={obsVConv}
                          onChange={(e) => setObsVConv(e.target.value)}
                          className="mt-1 w-full rounded border border-slate-200 px-2 py-1 font-mono text-xs"
                        />
                      </label>
                      <label className="text-xs font-medium text-slate-700">
                        Status
                        <select
                          value={obsStatus}
                          onChange={(e) =>
                            setObsStatus(e.target.value as ExperimentStatus)
                          }
                          className="mt-1 w-full rounded border border-slate-200 px-2 py-1 text-xs"
                        >
                          <option value="Draft">Draft</option>
                          <option value="Running">Running</option>
                          <option value="Concluded">Concluded</option>
                          <option value="Paused">Paused</option>
                        </select>
                      </label>
                    </div>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <input
                        type="text"
                        value={obsNotes}
                        onChange={(e) => setObsNotes(e.target.value)}
                        placeholder="Outcome notes..."
                        className="rounded border border-slate-200 px-3 py-1.5 text-xs"
                      />
                      <input
                        type="text"
                        value={obsNextStep}
                        onChange={(e) => setObsNextStep(e.target.value)}
                        placeholder="Recommended next step..."
                        className="rounded border border-slate-200 px-3 py-1.5 text-xs"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="rounded border border-slate-200 px-3 py-1 text-xs text-slate-600"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="rounded bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700"
                      >
                        Save & Recalculate
                      </button>
                    </div>
                  </form>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
