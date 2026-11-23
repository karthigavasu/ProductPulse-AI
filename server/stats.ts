import type {
  BusinessMetrics,
  BusinessScenario,
  ExperimentStatistics,
} from '../src/types/productpulse.js';

export function calculateRiceScore(
  reach: number,
  impact: number,
  confidencePct: number,
  effort: number
): number {
  if (!Number.isFinite(reach) || reach < 0) {
    throw new Error('Reach must be a non-negative number.');
  }
  if (!Number.isFinite(impact) || impact <= 0) {
    throw new Error('Impact must be a positive number.');
  }
  if (!Number.isFinite(confidencePct) || confidencePct <= 0 || confidencePct > 100) {
    throw new Error('Confidence must be between 1 and 100 percent.');
  }
  if (!Number.isFinite(effort) || effort <= 0) {
    throw new Error('Effort must be greater than 0 person-months.');
  }

  const confidenceDecimal = confidencePct / 100;
  const raw = (reach * impact * confidenceDecimal) / effort;
  return Math.round(raw * 100) / 100;
}

/**
 * Standard normal cumulative distribution function approximation (Abramowitz & Stegun 7.1.26)
 */
function normalCdf(z: number): number {
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const erf =
    1 -
    (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t) * Math.exp(-x * x);
  return 0.5 * (1 + sign * erf);
}

export function calculateAbTestStatistics(
  controlVisitors: number,
  controlConversions: number,
  variantVisitors: number,
  variantConversions: number
): ExperimentStatistics {
  const cVis = Math.max(0, Math.floor(controlVisitors));
  const cConv = Math.min(cVis, Math.max(0, Math.floor(controlConversions)));
  const vVis = Math.max(0, Math.floor(variantVisitors));
  const vConv = Math.min(vVis, Math.max(0, Math.floor(variantConversions)));

  const controlRate = cVis > 0 ? cConv / cVis : 0;
  const variantRate = vVis > 0 ? vConv / vVis : 0;
  const absoluteLift = variantRate - controlRate;
  const relativeLiftPct =
    controlRate > 0 ? ((variantRate - controlRate) / controlRate) * 100 : null;

  // Adequacy check for normal approximation in two-proportion z-test:
  // requires >= 30 observations per arm and at least 5 expected successes & failures per arm.
  const pooledRate = cVis + vVis > 0 ? (cConv + vConv) / (cVis + vVis) : 0;
  const expectedControlSuccess = cVis * pooledRate;
  const expectedControlFailure = cVis * (1 - pooledRate);
  const expectedVariantSuccess = vVis * pooledRate;
  const expectedVariantFailure = vVis * (1 - pooledRate);

  const sampleAdequate =
    cVis >= 30 &&
    vVis >= 30 &&
    expectedControlSuccess >= 5 &&
    expectedControlFailure >= 5 &&
    expectedVariantSuccess >= 5 &&
    expectedVariantFailure >= 5;

  if (!sampleAdequate || pooledRate === 0 || pooledRate === 1) {
    return {
      controlRate: Number((controlRate * 100).toFixed(2)),
      variantRate: Number((variantRate * 100).toFixed(2)),
      absoluteLift: Number((absoluteLift * 100).toFixed(2)),
      relativeLiftPct:
        relativeLiftPct !== null ? Number(relativeLiftPct.toFixed(2)) : null,
      zScore: null,
      pValue: null,
      ci95Low: null,
      ci95High: null,
      sampleAdequate: false,
      isSignificant: false,
      confidenceLevelPct: null,
      recommendation:
        'Continue collecting observations before drawing a statistical conclusion.',
      caveat:
        'Sample size or conversion counts are too small for a reliable two-proportion z-test (requires >= 30 visitors and >= 5 expected conversions/non-conversions per arm).',
    };
  }

  const pooledSe = Math.sqrt(pooledRate * (1 - pooledRate) * (1 / cVis + 1 / vVis));
  const zScore = pooledSe > 0 ? (variantRate - controlRate) / pooledSe : 0;
  const pValue = Math.max(0, Math.min(1, 2 * (1 - normalCdf(Math.abs(zScore)))));

  const unpooledSe = Math.sqrt(
    (controlRate * (1 - controlRate)) / cVis +
      (variantRate * (1 - variantRate)) / vVis
  );
  const margin = 1.96 * unpooledSe;
  const ci95Low = (absoluteLift - margin) * 100;
  const ci95High = (absoluteLift + margin) * 100;

  const isSignificant = pValue < 0.05;
  const confidenceLevelPct = Number(((1 - pValue) * 100).toFixed(1));

  let recommendation =
    'Result is not statistically significant (p >= 0.05). Keep control or extend test duration if higher power is required.';
  if (isSignificant && absoluteLift > 0) {
    recommendation =
      'Variant shows a statistically significant positive lift (p < 0.05). Consider rolling out Variant with post-launch monitoring.';
  } else if (isSignificant && absoluteLift < 0) {
    recommendation =
      'Variant shows a statistically significant negative impact (p < 0.05). Retain Control and investigate regression causes.';
  }

  return {
    controlRate: Number((controlRate * 100).toFixed(2)),
    variantRate: Number((variantRate * 100).toFixed(2)),
    absoluteLift: Number((absoluteLift * 100).toFixed(2)),
    relativeLiftPct:
      relativeLiftPct !== null ? Number(relativeLiftPct.toFixed(2)) : null,
    zScore: Number(zScore.toFixed(3)),
    pValue: Number(pValue.toFixed(4)),
    ci95Low: Number(ci95Low.toFixed(2)),
    ci95High: Number(ci95High.toFixed(2)),
    sampleAdequate: true,
    isSignificant,
    confidenceLevelPct,
    recommendation,
    caveat:
      'Assumes independent randomized assignment and stationary conversion behavior over the observation window.',
  };
}

export function calculateBusinessCaseMetrics(
  scenario: Pick<
    BusinessScenario,
    | 'monthlyPrice'
    | 'estimatedCustomers'
    | 'monthlyChurnPct'
    | 'cac'
    | 'grossMarginPct'
    | 'fixedMonthlyCost'
    | 'variableCostPerUser'
  >
): BusinessMetrics {
  const mrr = scenario.monthlyPrice * scenario.estimatedCustomers;
  const arr = mrr * 12;
  const marginRatio = Math.max(0, Math.min(1, scenario.grossMarginPct / 100));
  const monthlyGrossProfit = mrr * marginRatio;
  const totalVariableCost = scenario.variableCostPerUser * scenario.estimatedCustomers;
  const monthlyTotalCost = scenario.fixedMonthlyCost + totalVariableCost;
  const monthlyNetProfit = monthlyGrossProfit - monthlyTotalCost;

  const churnDecimal = scenario.monthlyChurnPct / 100;
  const contributionPerUser =
    scenario.monthlyPrice * marginRatio - scenario.variableCostPerUser;

  const ltv =
    churnDecimal > 0
      ? (scenario.monthlyPrice * marginRatio) / churnDecimal
      : scenario.monthlyPrice * marginRatio * 36;

  const ltvCacRatio = scenario.cac > 0 ? ltv / scenario.cac : null;
  const cacPaybackMonths =
    scenario.cac > 0 && contributionPerUser > 0
      ? scenario.cac / contributionPerUser
      : null;

  const breakEvenCustomers =
    contributionPerUser > 0
      ? Math.ceil(scenario.fixedMonthlyCost / contributionPerUser)
      : null;

  const annualAcquisitionSpend = scenario.cac * scenario.estimatedCustomers;
  const totalAnnualInvestment =
    scenario.fixedMonthlyCost * 12 + totalVariableCost * 12 + annualAcquisitionSpend;
  const annualRoiPct =
    totalAnnualInvestment > 0
      ? ((arr * marginRatio - totalAnnualInvestment) / totalAnnualInvestment) * 100
      : null;

  return {
    mrr: Number(mrr.toFixed(2)),
    arr: Number(arr.toFixed(2)),
    monthlyGrossProfit: Number(monthlyGrossProfit.toFixed(2)),
    monthlyTotalCost: Number(monthlyTotalCost.toFixed(2)),
    monthlyNetProfit: Number(monthlyNetProfit.toFixed(2)),
    ltv: Number(ltv.toFixed(2)),
    ltvCacRatio: ltvCacRatio !== null ? Number(ltvCacRatio.toFixed(2)) : null,
    cacPaybackMonths:
      cacPaybackMonths !== null ? Number(cacPaybackMonths.toFixed(1)) : null,
    breakEvenCustomers,
    annualRoiPct: annualRoiPct !== null ? Number(annualRoiPct.toFixed(1)) : null,
  };
}
