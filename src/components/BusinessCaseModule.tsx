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
import { Calculator, Save } from 'lucide-react';
import { api, type BusinessCaseWithMetrics } from '../lib/api';
import type { AuthUser } from '../types/productpulse';

interface BusinessCaseModuleProps {
  currentUser: AuthUser | null;
  onRequireAuth: () => void;
}

export const BusinessCaseModule: React.FC<BusinessCaseModuleProps> = ({
  currentUser,
  onRequireAuth,
}) => {
  const [scenarios, setScenarios] = useState<BusinessCaseWithMetrics[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  // Live editable assumptions
  const [monthlyPrice, setMonthlyPrice] = useState(149);
  const [estimatedCustomers, setEstimatedCustomers] = useState(260);
  const [monthlyChurnPct, setMonthlyChurnPct] = useState(2.4);
  const [cac, setCac] = useState(540);
  const [grossMarginPct, setGrossMarginPct] = useState(84);
  const [fixedMonthlyCost, setFixedMonthlyCost] = useState(14000);
  const [variableCostPerUser, setVariableCostPerUser] = useState(9);
  const [notes, setNotes] = useState('');

  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const syncFormFromScenario = (s: BusinessCaseWithMetrics) => {
    setSelectedId(s.id);
    setMonthlyPrice(s.monthlyPrice);
    setEstimatedCustomers(s.estimatedCustomers);
    setMonthlyChurnPct(s.monthlyChurnPct);
    setCac(s.cac);
    setGrossMarginPct(s.grossMarginPct);
    setFixedMonthlyCost(s.fixedMonthlyCost);
    setVariableCostPerUser(s.variableCostPerUser);
    setNotes(s.notes);
  };

  const loadScenarios = async () => {
    setLoading(true);
    try {
      const list = await api.getBusinessCases();
      setScenarios(list);
      if (list.length > 0 && selectedId === null) {
        syncFormFromScenario(list[1] ?? list[0]);
      } else if (selectedId !== null) {
        const match = list.find((item) => item.id === selectedId);
        if (match) syncFormFromScenario(match);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load scenarios.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadScenarios();
  }, []);

  // Immediate live calculations as user adjusts assumptions
  const mrr = monthlyPrice * estimatedCustomers;
  const arr = mrr * 12;
  const marginRatio = grossMarginPct / 100;
  const monthlyGrossProfit = mrr * marginRatio;
  const monthlyTotalCost = fixedMonthlyCost + variableCostPerUser * estimatedCustomers;
  const monthlyNetProfit = monthlyGrossProfit - monthlyTotalCost;
  const contributionPerUser = monthlyPrice * marginRatio - variableCostPerUser;
  const ltv =
    monthlyChurnPct > 0
      ? (monthlyPrice * marginRatio) / (monthlyChurnPct / 100)
      : monthlyPrice * marginRatio * 36;
  const ltvCacRatio = cac > 0 ? ltv / cac : null;
  const cacPaybackMonths =
    cac > 0 && contributionPerUser > 0 ? cac / contributionPerUser : null;
  const breakEvenCustomers =
    contributionPerUser > 0 ? Math.ceil(fixedMonthlyCost / contributionPerUser) : null;
  const annualInvestment =
    fixedMonthlyCost * 12 +
    variableCostPerUser * estimatedCustomers * 12 +
    cac * estimatedCustomers;
  const annualRoiPct =
    annualInvestment > 0
      ? ((arr * marginRatio - annualInvestment) / annualInvestment) * 100
      : null;

  // Break-even curve data across customer scale
  const maxChartCustomers = Math.max(estimatedCustomers * 1.6, (breakEvenCustomers ?? 200) * 1.5, 100);
  const step = Math.max(10, Math.round(maxChartCustomers / 8));
  const breakEvenChartData = Array.from({ length: 9 }, (_, i) => {
    const cust = i * step;
    return {
      customers: cust,
      grossRevenueProfit: Math.round(cust * monthlyPrice * marginRatio),
      totalCost: Math.round(fixedMonthlyCost + cust * variableCostPerUser),
    };
  });

  const handleSaveAssumptions = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;
    if (!currentUser) {
      onRequireAuth();
      return;
    }
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await api.updateBusinessCase(selectedId, {
        monthlyPrice,
        estimatedCustomers,
        monthlyChurnPct,
        cac,
        grossMarginPct,
        fixedMonthlyCost,
        variableCostPerUser,
        notes,
      });
      setNotice('Saved updated pricing & cost assumptions to database.');
      await loadScenarios();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Business Case & Pricing Analysis
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Interactive SaaS unit economics, CAC/LTV, break-even modeling, and subscription tier comparisons
          </p>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-900">
          Modeled Assumptions (Not Audited Accounting Actuals)
        </div>
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

      {/* Scenario Selector */}
      <div className="flex flex-wrap items-center gap-2">
        {scenarios.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => syncFormFromScenario(s)}
            className={`whitespace-nowrap rounded-lg border px-3.5 py-2 text-xs font-medium transition-colors ${
              selectedId === s.id
                ? 'border-blue-600 bg-blue-50 text-blue-800'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            {s.tierName} — {s.name}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="h-72 animate-pulse rounded-xl border border-slate-200 bg-white" />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Interactive Assumptions Panel */}
          <form
            onSubmit={handleSaveAssumptions}
            className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 lg:col-span-5"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Calculator className="h-4 w-4 text-blue-600" />
                <h2 className="text-sm font-semibold text-slate-900">
                  Interactive Scenario Assumptions
                </h2>
              </div>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" />
                {saving ? 'Saving...' : 'Save Scenario'}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-medium text-slate-700">
                Monthly Price ($/mo)
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={monthlyPrice}
                  onChange={(e) => setMonthlyPrice(Number(e.target.value) || 0)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 font-mono text-sm"
                />
              </label>
              <label className="text-xs font-medium text-slate-700">
                Estimated Customers
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={estimatedCustomers}
                  onChange={(e) => setEstimatedCustomers(Number(e.target.value) || 0)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 font-mono text-sm"
                />
              </label>
              <label className="text-xs font-medium text-slate-700">
                Monthly Churn (%)
                <input
                  type="number"
                  min={0.1}
                  max={100}
                  step={0.1}
                  value={monthlyChurnPct}
                  onChange={(e) => setMonthlyChurnPct(Number(e.target.value) || 0.1)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 font-mono text-sm"
                />
              </label>
              <label className="text-xs font-medium text-slate-700">
                Customer Acq. Cost (CAC $)
                <input
                  type="number"
                  min={0}
                  step={10}
                  value={cac}
                  onChange={(e) => setCac(Number(e.target.value) || 0)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 font-mono text-sm"
                />
              </label>
              <label className="text-xs font-medium text-slate-700">
                Gross Margin (%)
                <input
                  type="number"
                  min={1}
                  max={100}
                  step={1}
                  value={grossMarginPct}
                  onChange={(e) => setGrossMarginPct(Number(e.target.value) || 1)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 font-mono text-sm"
                />
              </label>
              <label className="text-xs font-medium text-slate-700">
                Variable Cost / User ($/mo)
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  value={variableCostPerUser}
                  onChange={(e) => setVariableCostPerUser(Number(e.target.value) || 0)}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 font-mono text-sm"
                />
              </label>
            </div>

            <label className="block text-xs font-medium text-slate-700">
              Fixed Monthly Operating Cost ($)
              <input
                type="number"
                min={0}
                step={500}
                value={fixedMonthlyCost}
                onChange={(e) => setFixedMonthlyCost(Number(e.target.value) || 0)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 font-mono text-sm"
              />
            </label>

            <label className="block text-xs font-medium text-slate-700">
              Assumption Rationale & Notes
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs"
              />
            </label>
          </form>

          {/* Live Calculated Outcomes + Break-Even Chart */}
          <div className="space-y-6 lg:col-span-7">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="text-xs text-slate-500">Projected MRR</div>
                <div className="mt-1 font-mono text-xl font-semibold text-blue-700 tabular-nums">
                  ${mrr.toLocaleString()}
                </div>
                <div className="mt-1 font-mono text-[11px] text-slate-500 tabular-nums">
                  ARR: ${arr.toLocaleString()}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="text-xs text-slate-500">Monthly Net Profit</div>
                <div
                  className={`mt-1 font-mono text-xl font-semibold tabular-nums ${
                    monthlyNetProfit >= 0 ? 'text-teal-700' : 'text-red-700'
                  }`}
                >
                  ${Math.round(monthlyNetProfit).toLocaleString()}
                </div>
                <div className="mt-1 font-mono text-[11px] text-slate-500 tabular-nums">
                  Costs: ${Math.round(monthlyTotalCost).toLocaleString()}/mo
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="text-xs text-slate-500">LTV : CAC Ratio</div>
                <div className="mt-1 font-mono text-xl font-semibold text-purple-700 tabular-nums">
                  {ltvCacRatio !== null ? `${ltvCacRatio.toFixed(2)}x` : 'N/A'}
                </div>
                <div className="mt-1 font-mono text-[11px] text-slate-500 tabular-nums">
                  LTV: ${Math.round(ltv).toLocaleString()}
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="text-xs text-slate-500">Break-Even Point</div>
                <div className="mt-1 font-mono text-xl font-semibold text-slate-900 tabular-nums">
                  {breakEvenCustomers !== null ? `${breakEvenCustomers} accts` : 'Unprofitable'}
                </div>
                <div className="mt-1 font-mono text-[11px] text-slate-500 tabular-nums">
                  Payback:{' '}
                  {cacPaybackMonths !== null ? `${cacPaybackMonths.toFixed(1)} mo` : 'N/A'} ·{' '}
                  ROI: {annualRoiPct !== null ? `${annualRoiPct.toFixed(1)}%` : 'N/A'}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h3 className="text-sm font-semibold text-slate-900">
                Break-Even Sensitivity Curve (Monthly Gross Profit vs Operating Cost)
              </h3>
              <p className="mb-4 text-xs text-slate-500">
                Blue: Gross Profit ($) · Purple: Fixed + Variable Costs ($)
              </p>
              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={breakEvenChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis
                      dataKey="customers"
                      tick={{ fontSize: 11, fill: '#64748B' }}
                      label={{ value: 'Active Customers', position: 'insideBottom', offset: -2, fontSize: 11 }}
                    />
                    <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="grossRevenueProfit"
                      name="Monthly Gross Profit ($)"
                      stroke="#2563EB"
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="totalCost"
                      name="Total Monthly Cost ($)"
                      stroke="#7C3AED"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Multi-Tier Pricing Comparison Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-3.5">
          <h2 className="text-sm font-semibold text-slate-900">
            Subscription Pricing & Scenario Comparison Matrix
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-2.5 font-medium">Tier / Scenario</th>
                <th className="px-4 py-2.5 text-right font-medium">Price/mo</th>
                <th className="px-4 py-2.5 text-right font-medium">Est. Customers</th>
                <th className="px-4 py-2.5 text-right font-medium">MRR</th>
                <th className="px-4 py-2.5 text-right font-medium">LTV</th>
                <th className="px-4 py-2.5 text-right font-medium">CAC</th>
                <th className="px-4 py-2.5 text-right font-medium">LTV:CAC</th>
                <th className="px-4 py-2.5 text-right font-medium">Break-Even</th>
                <th className="px-4 py-2.5 text-right font-medium">Annual ROI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {scenarios.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-semibold text-slate-900">
                    {s.tierName}
                    <div className="font-normal text-slate-500">{s.name}</div>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                    ${s.monthlyPrice}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                    {s.estimatedCustomers}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono font-semibold text-blue-700 tabular-nums">
                    ${s.metrics.mrr.toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                    ${Math.round(s.metrics.ltv).toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                    ${s.cac.toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                    {s.metrics.ltvCacRatio !== null ? `${s.metrics.ltvCacRatio}x` : 'N/A'}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                    {s.metrics.breakEvenCustomers ?? 'N/A'}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono font-semibold text-teal-700 tabular-nums">
                    {s.metrics.annualRoiPct !== null ? `${s.metrics.annualRoiPct}%` : 'N/A'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
