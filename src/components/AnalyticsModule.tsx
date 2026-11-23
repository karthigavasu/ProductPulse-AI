import React, { useEffect, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Download } from 'lucide-react';
import { api } from '../lib/api';
import type { OverviewSummary } from '../types/productpulse';

export const AnalyticsModule: React.FC = () => {
  const [rangeDays, setRangeDays] = useState<number>(30);
  const [data, setData] = useState<OverviewSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .getOverview(rangeDays)
      .then(setData)
      .finally(() => setLoading(false));
  }, [rangeDays]);

  const exportCsv = () => {
    if (!data) return;
    const headers = [
      'date',
      'total_users',
      'active_users',
      'new_users',
      'retention_rate',
      'feature_adoption_rate',
      'csat_score',
      'engagement_score',
      'conversion_rate',
      'is_synthetic',
    ];
    const rows = data.series.map((s) =>
      [
        s.date,
        s.totalUsers,
        s.activeUsers,
        s.newUsers,
        s.retentionRate,
        s.featureAdoptionRate,
        s.csatScore,
        s.engagementScore,
        s.conversionRate,
        s.isSynthetic,
      ].join(',')
    );
    const blob = new Blob([[headers.join(','), ...rows].join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `productpulse-analytics-${rangeDays}d.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Product Analytics
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Retention, feature adoption, engagement index, CSAT, and conversion trends ·{' '}
            <span className="font-medium text-amber-700">
              {data?.hasSyntheticData ? 'Synthetic Demo Telemetry Active' : 'Live Telemetry'}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
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
                {d}D Comparison
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={exportCsv}
            disabled={!data}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {loading && !data ? (
        <div className="h-80 animate-pulse rounded-xl border border-slate-200 bg-white" />
      ) : data ? (
        <>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="text-base font-semibold text-slate-900">
                Retention & Feature Adoption (%)
              </h2>
              <p className="mb-4 text-xs text-slate-500">
                Blue: Retention % · Purple: Feature Adoption %
              </p>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.series}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: '#64748B' }}
                      tickFormatter={(v: string) => v.slice(5)}
                    />
                    <YAxis domain={[40, 90]} tick={{ fontSize: 11, fill: '#64748B' }} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="retentionRate"
                      name="Retention (%)"
                      stroke="#2563EB"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="featureAdoptionRate"
                      name="Feature Adoption (%)"
                      stroke="#7C3AED"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="text-base font-semibold text-slate-900">
                Engagement Score & Conversion Rate
              </h2>
              <p className="mb-4 text-xs text-slate-500">
                Teal: Engagement Index (0–100) · Blue: Conversion %
              </p>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.series}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: '#64748B' }}
                      tickFormatter={(v: string) => v.slice(5)}
                    />
                    <YAxis yAxisId="left" domain={[50, 100]} tick={{ fontSize: 11, fill: '#64748B' }} />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      domain={[2, 6]}
                      tick={{ fontSize: 11, fill: '#64748B' }}
                    />
                    <Tooltip />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="engagementScore"
                      name="Engagement Index"
                      stroke="#0D9488"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="conversionRate"
                      name="Conversion (%)"
                      stroke="#2563EB"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-5 py-3.5">
              <h2 className="text-sm font-semibold text-slate-900">
                Daily Telemetry Breakdown
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Date</th>
                    <th className="px-4 py-2.5 text-right font-medium">Total Users</th>
                    <th className="px-4 py-2.5 text-right font-medium">DAU</th>
                    <th className="px-4 py-2.5 text-right font-medium">New</th>
                    <th className="px-4 py-2.5 text-right font-medium">Retention</th>
                    <th className="px-4 py-2.5 text-right font-medium">Adoption</th>
                    <th className="px-4 py-2.5 text-right font-medium">CSAT</th>
                    <th className="px-4 py-2.5 text-right font-medium">Conv. Rate</th>
                    <th className="px-4 py-2.5 font-medium">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[...data.series].reverse().slice(0, 15).map((row) => (
                    <tr key={row.date} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 font-mono text-slate-900">{row.date}</td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                        {row.totalUsers.toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                        {row.activeUsers.toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                        {row.newUsers.toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                        {row.retentionRate}%
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                        {row.featureAdoptionRate}%
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                        {row.csatScore}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                        {row.conversionRate}%
                      </td>
                      <td className="px-4 py-2.5 text-slate-500">
                        {row.isSynthetic ? 'Synthetic Demo' : 'Live Snapshot'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
};
