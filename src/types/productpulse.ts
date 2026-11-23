export type UserRole = 'admin' | 'user';

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
}

export type FeedbackCategory =
  | 'Feature Requests'
  | 'Bug Reports'
  | 'Usability Issues'
  | 'Performance Issues'
  | 'General Suggestions';

export type FeedbackStatus =
  | 'New'
  | 'Under Review'
  | 'Planned'
  | 'Resolved'
  | 'Archived';

export type SentimentLabel = 'positive' | 'neutral' | 'negative';

export interface FeedbackItem {
  id: number;
  title: string;
  content: string;
  customerSegment: string;
  category: FeedbackCategory;
  status: FeedbackStatus;
  rating: number;
  sentiment: SentimentLabel;
  sentimentScore: number;
  keywords: string[];
  topics: string[];
  analysisMethod: 'local-nlp' | 'gemini';
  analysisExplanation: string;
  isSynthetic: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface DailyMetric {
  id: number;
  date: string;
  totalUsers: number;
  activeUsers: number;
  newUsers: number;
  retainedUsers: number;
  retentionRate: number;
  featureAdoptionRate: number;
  csatScore: number;
  engagementScore: number;
  conversionRate: number;
  isSynthetic: boolean;
}

export type RoadmapStatus =
  | 'Backlog'
  | 'Planned'
  | 'In Progress'
  | 'Testing'
  | 'Released';

export type MoscowPriority =
  | 'Must Have'
  | 'Should Have'
  | 'Could Have'
  | "Won't Have";

export interface ProductFeature {
  id: number;
  title: string;
  description: string;
  category: string;
  reach: number;
  impact: number;
  confidence: number;
  effort: number;
  riceScore: number;
  manualPriorityOverride: number | null;
  overrideReason: string;
  moscowPriority: MoscowPriority;
  roadmapStatus: RoadmapStatus;
  initiative: string;
  targetReleaseDate: string;
  milestone: string;
  sprint: string;
  owner: string;
  isSynthetic: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ExperimentStatus = 'Draft' | 'Running' | 'Concluded' | 'Paused';

export interface ExperimentStatistics {
  controlRate: number;
  variantRate: number;
  absoluteLift: number;
  relativeLiftPct: number | null;
  zScore: number | null;
  pValue: number | null;
  ci95Low: number | null;
  ci95High: number | null;
  sampleAdequate: boolean;
  isSignificant: boolean;
  confidenceLevelPct: number | null;
  recommendation: string;
  caveat: string;
}

export interface Experiment {
  id: number;
  name: string;
  hypothesis: string;
  metricName: string;
  status: ExperimentStatus;
  controlName: string;
  controlVisitors: number;
  controlConversions: number;
  variantName: string;
  variantVisitors: number;
  variantConversions: number;
  outcomeNotes: string;
  nextStepRecommendation: string;
  isSynthetic: boolean;
  createdAt: string;
  updatedAt: string;
  statistics: ExperimentStatistics;
}

export interface BusinessScenario {
  id: number;
  name: string;
  tierName: string;
  monthlyPrice: number;
  estimatedCustomers: number;
  monthlyChurnPct: number;
  cac: number;
  grossMarginPct: number;
  fixedMonthlyCost: number;
  variableCostPerUser: number;
  notes: string;
  isAssumption: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BusinessMetrics {
  mrr: number;
  arr: number;
  monthlyGrossProfit: number;
  monthlyTotalCost: number;
  monthlyNetProfit: number;
  ltv: number;
  ltvCacRatio: number | null;
  cacPaybackMonths: number | null;
  breakEvenCustomers: number | null;
  annualRoiPct: number | null;
}

export type UxArtifactType =
  | 'persona'
  | 'journey_stage'
  | 'pain_point'
  | 'user_story';

export interface UxArtifact {
  id: number;
  type: UxArtifactType;
  title: string;
  subtitle: string;
  content: Record<string, unknown>;
  status: string;
  isTemplate: boolean;
  createdAt: string;
  updatedAt: string;
}

export type PmDocType =
  | 'prd'
  | 'goal'
  | 'strategy'
  | 'sprint_note'
  | 'release_note';

export interface PmDocument {
  id: number;
  docType: PmDocType;
  title: string;
  status: string;
  moscow: MoscowPriority;
  sprint: string;
  owner: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLogEntry {
  id: number;
  actorEmail: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface OverviewSummary {
  rangeDays: number;
  latestDate: string;
  hasSyntheticData: boolean;
  kpis: {
    totalUsers: number;
    activeUsers: number;
    dauMauRatio: number;
    customerRetention: number;
    featureAdoption: number;
    customerSatisfaction: number;
    feedbackVolume: number;
    productEngagement: number;
    conversionRate: number;
  };
  deltas: {
    activeUsersPct: number;
    retentionDelta: number;
    adoptionDelta: number;
    csatDelta: number;
    engagementDelta: number;
    conversionDelta: number;
  };
  series: DailyMetric[];
  feedbackByCategory: Array<{ category: string; count: number }>;
  feedbackBySentiment: Array<{ sentiment: string; count: number }>;
}
