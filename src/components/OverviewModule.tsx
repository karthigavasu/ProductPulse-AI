import React, { useEffect, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Plus, RefreshCw } from 'lucide-react';
import { api } from '../lib/api';
import type { AuthUser, OverviewSummary } from '../types/productpulse';

interface OverviewModuleProps {
  currentUser: AuthUser | null;
  onRequireAuth: () => void;
  onNavigate: (tab: string) => void;
}

export const OverviewModule: React.FC<OverviewModuleProps> = ({
  currentUser,
  onRequireAuth,
  onNavigate,
}) => {
  const [rangeDays, setRangeDays] = useState<number>(14);
  const [data, setData] = useState<OverviewSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddMetric, setShowAddMetric] = useState(false);

  // New metric snapshot form state
  const [date, setDate] = useState('2026-11-24');
  const [totalUsers, setTotalUsers] = useState('12950');
  const [activeUsers, setActiveUsers] = useState('4290');
  const [newUsers, setNewUsers] = useState('72');
  const [retentionRate, setRetentionRate] = useState('78.4');
  const [featureAdoptionRate, setFeatureAdoptionRate] = useState('63.2');
  const [csatScore, setCsatScore] = useState('4.46');
  const [engagementScore, setEngagementScore] = useState('76.0');
  const [conversionRate, setConversionRate] = useState('4.42');
  const [saving, setSaving] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState('');

  const loadData = async (days: number) => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getOverview(days);
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load overview metrics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData(rangeDays);
  }, [rangeDays]);

  const handleSaveSnapshot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      onRequireAuth();
      return;
    }
    setSaving(true);
    setSaveFeedback('');
    try {
      await api.upsertMetricSnapshot({
        date,
        totalUsers: Number(totalUsers),
        activeUsers: Number(activeUsers),
        newUsers: Number(newUsers),
        retentionRate: Number(retentionRate),
        featureAdoptionRate: Number(featureAdoptionRate),
        csatScore: Number(csatScore),
        engagementScore: Number(engagementScore),
        conversionRate: Number(conversionRate),
      });
      setShowAddMetric(false);
      setSaveFeedback(`Saved live metric snapshot for ${date}.`);
      await loadData(rangeDays);
    } catch (err) {
      setSaveFeedback(err instanceof Error ? err.message : 'Failed to save metric.');
    } finally {
      setSaving(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, idx) => (
            <div
              key={idx}
              className="h-28 animate-pulse rounded-xl border border-slate-200 bg-white p-5"
            />
          ))}
        </div>
        <div className="h-80 animate-pulse rounded-xl border border-slate-200 bg-white" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-800">
        {error}
      </div>
    );
  }

  if (!data) return null;

  const { kpis, deltas } = data;

  const kpiCards = [
    {
      label: 'Total Users',
      value: kpis.totalUsers.toLocaleString(),
      sub: `Latest snapshot ${data.latestDate}`,
      delta: null,
      accent: 'text-blue-700',
    },
    {
      label: 'Avg Active Users',
      value: kpis.activeUsers.toLocaleString(),
      sub: `DAU/Total ratio ${kpis.dauMauRatio}%`,
      delta: `${deltas.activeUsersPct >= 0 ? '+' : ''}${deltas.activeUsersPct}% vs prior`,
      positive: deltas.activeUsersPct >= 0,
      accent: 'text-blue-700',
    },
    {
      label: 'Customer Retention',
      value: `${kpis.customerRetention}%`,
      sub: 'Window average',
      delta: `${deltas.retentionDelta >= 0 ? '+' : ''}${deltas.retentionDelta} pp vs prior`,
      positive: deltas.retentionDelta >= 0,
      accent: 'text-teal-700',
    },
    {
      label: 'Feature Adoption',
      value: `${kpis.featureAdoption}%`,
      sub: 'Core workflows',
      delta: `${deltas.adoptionDelta >= 0 ? '+' : ''}${deltas.adoptionDelta} pp vs prior`,
      positive: deltas.adoptionDelta >= 0,
      accent: 'text-purple-700',
    },
    {
      label: 'Customer Satisfaction',
      value: `${kpis.customerSatisfaction} / 5.0`,
      sub: 'CSAT survey proxy',
      delta: `${deltas.csatDelta >= 0 ? '+' : ''}${deltas.csatDelta} vs prior`,
      positive: deltas.csatDelta >= 0,
      accent: 'text-teal-700',
    },
    {
      label: 'Feedback Volume',
      value: kpis.feedbackVolume.toLocaleString(),
      sub: 'Tracked items in database',
      delta: 'View triage queue',
      positive: true,
      accent: 'text-purple-700',
      onClick: () => onNavigate('feedback'),
    },
    {
      label: 'Product Engagement',
      value: `${kpis.productEngagement} / 100`,
      sub: 'Composite engagement index',
      delta: `${deltas.engagementDelta >= 0 ? '+' : ''}${deltas.engagementDelta} pts vs prior`,
      positive: deltas.engagementDelta >= 0,
      accent: 'text-blue-700',
    },
    {
      label: 'Conversion Rate',
      value: `${kpis.conversionRate}%`,
      sub: 'Trial-to-paid funnel',
      delta: `${deltas.conversionDelta >= 0 ? '+' : ''}${deltas.conversionDelta} pp vs prior`,
      positive: deltas.conversionDelta >= 0,
      accent: 'text-teal-700',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Product Overview
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>Calculated directly from SQLite telemetry & feedback tables</span>
            <span aria-hidden="true">·</span>
            <span className="font-medium text-amber-700">
              {data.hasSyntheticData
                ? 'Includes Synthetic Demo Dataset'
                : 'Live Workspace Data'}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div
            className="flex items-center gap-1 rounded-lg bg-slate-100 p-1"
            role="group"
            aria-label="Date range selector"
          >
            {[7, 14, 30].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setRangeDays(d)}
                className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  rangeDays === d
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Last {d} Days
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => void loadData(rangeDays)}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>

          <button
            type="button"
            onClick={() => {
              if (!currentUser) {
                onRequireAuth();
              } else {
                setShowAddMetric((prev) => !prev);
              }
            }}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-700"
          >
            <Plus className="h-3.5 w-3.5" />
            Log Metric Snapshot
          </button>
        </div>
      </div>

      {saveFeedback && (
        <div className="rounded-lg border border-teal-200 bg-teal-50 px-4 py-2.5 text-xs font-medium text-teal-900">
          {saveFeedback}
        </div>
      )}

      {showAddMetric && (
        <form
          onSubmit={handleSaveSnapshot}
          className="rounded-xl border border-slate-200 bg-white p-5"
        >
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Record Live Daily Metric Snapshot
              </h2>
              <p className="text-xs text-slate-500">
                Persisted as non-synthetic telemetry in SQLite and immediately reflected in KPI calculations.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAddMetric(false)}
              className="text-xs text-slate-500 hover:text-slate-800"
            >
              Close
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <label className="text-xs font-medium text-slate-700">
              Date
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 font-mono text-xs"
              />
            </label>
            <label className="text-xs font-medium text-slate-700">
              Total Users
              <input
                type="number"
                required
                min={1}
                value={totalUsers}
                onChange={(e) => setTotalUsers(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 font-mono text-xs"
              />
            </label>
            <label className="text-xs font-medium text-slate-700">
              Active Users
              <input
                type="number"
                required
                min={0}
                value={activeUsers}
                onChange={(e) => setActiveUsers(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 font-mono text-xs"
              />
            </label>
            <label className="text-xs font-medium text-slate-700">
              New Users
              <input
                type="number"
                required
                min={0}
                value={newUsers}
                onChange={(e) => setNewUsers(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 font-mono text-xs"
              />
            </label>
            <label className="text-xs font-medium text-slate-700">
              Retention (%)
              <input
                type="number"
                step="0.1"
                required
                min={0}
                max={100}
                value={retentionRate}
                onChange={(e) => setRetentionRate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 font-mono text-xs"
              />
            </label>
            <label className="text-xs font-medium text-slate-700">
              Adoption (%)
              <input
                type="number"
                step="0.1"
                required
                min={0}
                max={100}
                value={featureAdoptionRate}
                onChange={(e) => setFeatureAdoptionRate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 font-mono text-xs"
              />
            </label>
            <label className="text-xs font-medium text-slate-700">
              CSAT (1-5)
              <input
                type="number"
                step="0.01"
                required
                min={1}
                max={5}
                value={csatScore}
                onChange={(e) => setCsatScore(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 font-mono text-xs"
              />
            </label>
            <label className="text-xs font-medium text-slate-700">
              Engagement (0-100)
              <input
                type="number"
                step="0.1"
                required
                min={0}
                max={100}
                value={engagementScore}
                onChange={(e) => setEngagementScore(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 font-mono text-xs"
              />
            </label>
            <label className="text-xs font-medium text-slate-700">
              Conversion (%)
              <input
                type="number"
                step="0.01"
                required
                min={0}
                max={100}
                value={conversionRate}
                onChange={(e) => setConversionRate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 font-mono text-xs"
              />
            </label>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={saving}
                className="w-full whitespace-nowrap rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Snapshot'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* 8 KPI Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpiCards.map((card) => (
          <div
            key={card.label}
            className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">{card.label}</span>
              {card.delta && (
                <span
                  className={`font-mono text-xs font-medium tabular-nums ${
                    card.positive ? 'text-teal-700' : 'text-red-600'
                  }`}
                >
                  {card.delta}
                </span>
              )}
            </div>
            <div
              className={`mt-2 font-mono text-2xl font-semibold tracking-tight tabular-nums ${card.accent}`}
            >
              {card.value}
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
              <span>{card.sub}</span>
              {card.onClick && (
                <button
                  type="button"
                  onClick={card.onClick}
                  className="font-medium text-blue-600 hover:underline"
                >
                  Open
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Active Users & Retained Cohort Trend
              </h2>
              <p className="text-xs text-slate-500">
                Daily active users compared with retained users over the selected {rangeDays}-day window
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-600">
              <span>Blue: Active Users</span>
              <span>Teal: Retained Users</span>
            </div>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.series} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="activeFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563EB" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#2563EB" stopOpacity={0.01} />
                  </linearGradient>
                  <linearGradient id="retainedFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0D9488" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#0D9488" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  tickFormatter={(v: string) => v.slice(5)}
                />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                <Tooltip
                  contentStyle={{
                    borderRadius: '8px',
                    borderColor: '#E2E8F0',
                    fontSize: '12px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="activeUsers"
                  name="Active Users"
                  stroke="#2563EB"
                  strokeWidth={2}
                  fill="url(#activeFill)"
                />
                <Area
                  type="monotone"
                  dataKey="retainedUsers"
                  name="Retained Users"
                  stroke="#0D9488"
                  strokeWidth={2}
                  fill="url(#retainedFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-slate-900">
              Feedback by Category
            </h2>
            <p className="text-xs text-slate-500">
              Distribution across all {kpis.feedbackVolume} recorded submissions
            </p>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.feedbackByCategory}
                layout="vertical"
                margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#64748B' }} />
                <YAxis
                  dataKey="category"
                  type="category"
                  width={122}
                  tick={{ fontSize: 11, fill: '#334155' }}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: '8px',
                    borderColor: '#E2E8F0',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="count" name="Items" fill="#7C3AED" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
