import type {
  AuditLogEntry,
  AuthUser,
  BusinessMetrics,
  BusinessScenario,
  Experiment,
  FeedbackItem,
  OverviewSummary,
  PmDocument,
  ProductFeature,
  UxArtifact,
} from '../types/productpulse';

let inMemoryToken: string | null = null;

export function setAuthToken(token: string | null): void {
  inMemoryToken = token;
}

export function getAuthToken(): string | null {
  return inMemoryToken;
}

async function apiRequest<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (inMemoryToken) {
    headers.set('Authorization', `Bearer ${inMemoryToken}`);
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text };
    }
  }

  if (!res.ok) {
    const errMsg =
      (data as { error?: string } | null)?.error ??
      `Request failed (${res.status})`;
    throw new Error(errMsg);
  }

  return data as T;
}

export interface AuthStatusResponse {
  hasAdmin: boolean;
  envAdminPasscodeConfigured: boolean;
  geminiConfigured: boolean;
  currentUser: AuthUser | null;
}

export interface BusinessCaseWithMetrics extends BusinessScenario {
  metrics: BusinessMetrics;
}

export interface FeedbackInsightsResponse {
  geminiConfigured: boolean;
  totalAnalyzed: number;
  summary: string;
  topFeatureRequests: string[];
  recurringComplaints: Array<{
    topic: string;
    count: number;
    avgRating: number;
    topKeywords: string[];
    sampleTitles: string[];
  }>;
  topKeywords: Array<{ keyword: string; count: number }>;
  topicBreakdown: Array<{ topic: string; count: number }>;
}

export interface DeliverableDoc {
  filename: string;
  title: string;
  category: 'PM Deliverable' | 'Research Template';
  content: string;
}

export const api = {
  getAuthStatus: () => apiRequest<AuthStatusResponse>('/api/auth/status'),
  claimAdmin: (payload: {
    email: string;
    name: string;
    password: string;
    adminPasscode?: string;
  }) =>
    apiRequest<{ token: string; user: AuthUser }>('/api/auth/claim-admin', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  register: (payload: { email: string; name: string; password: string }) =>
    apiRequest<{ token: string; user: AuthUser }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  login: (payload: { email: string; password: string }) =>
    apiRequest<{ token: string; user: AuthUser }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getAdminUsers: () => apiRequest<AuthUser[]>('/api/admin/users'),
  updateUserRole: (id: number, role: 'admin' | 'user') =>
    apiRequest<{ id: number; role: string }>(`/api/admin/users/${id}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    }),
  getAuditLogs: () => apiRequest<AuditLogEntry[]>('/api/admin/audit-logs'),

  getOverview: (days: number) =>
    apiRequest<OverviewSummary>(`/api/analytics/overview?days=${days}`),
  upsertMetricSnapshot: (payload: Record<string, unknown>) =>
    apiRequest<{ ok: boolean; date: string }>('/api/analytics/metrics', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getFeedback: (params: {
    search?: string;
    category?: string;
    status?: string;
    sentiment?: string;
  }) => {
    const qs = new URLSearchParams();
    if (params.search) qs.set('search', params.search);
    if (params.category && params.category !== 'All')
      qs.set('category', params.category);
    if (params.status && params.status !== 'All') qs.set('status', params.status);
    if (params.sentiment && params.sentiment !== 'All')
      qs.set('sentiment', params.sentiment);
    return apiRequest<FeedbackItem[]>(`/api/feedback?${qs.toString()}`);
  },
  getFeedbackInsights: () =>
    apiRequest<FeedbackInsightsResponse>('/api/feedback/insights'),
  createFeedback: (payload: Record<string, unknown>) =>
    apiRequest<FeedbackItem>('/api/feedback', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  importFeedbackCsv: (csvText: string) =>
    apiRequest<{ importedCount: number; errors: string[] }>(
      '/api/feedback/import-csv',
      {
        method: 'POST',
        body: JSON.stringify({ csvText }),
      }
    ),
  updateFeedback: (id: number, payload: Record<string, unknown>) =>
    apiRequest<FeedbackItem>(`/api/feedback/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  reanalyzeFeedback: (id: number) =>
    apiRequest<FeedbackItem>(`/api/feedback/${id}/reanalyze`, {
      method: 'POST',
    }),
  deleteFeedback: (id: number) =>
    apiRequest<{ deleted: boolean; id: number }>(`/api/feedback/${id}`, {
      method: 'DELETE',
    }),

  getFeatures: () => apiRequest<ProductFeature[]>('/api/features'),
  createFeature: (payload: Record<string, unknown>) =>
    apiRequest<ProductFeature>('/api/features', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateFeature: (id: number, payload: Record<string, unknown>) =>
    apiRequest<ProductFeature>(`/api/features/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deleteFeature: (id: number) =>
    apiRequest<{ deleted: boolean; id: number }>(`/api/features/${id}`, {
      method: 'DELETE',
    }),

  getExperiments: () => apiRequest<Experiment[]>('/api/experiments'),
  createExperiment: (payload: Record<string, unknown>) =>
    apiRequest<Experiment>('/api/experiments', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateExperiment: (id: number, payload: Record<string, unknown>) =>
    apiRequest<Experiment>(`/api/experiments/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  getBusinessCases: () =>
    apiRequest<BusinessCaseWithMetrics[]>('/api/business-cases'),
  createBusinessCase: (payload: Record<string, unknown>) =>
    apiRequest<BusinessCaseWithMetrics>('/api/business-cases', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateBusinessCase: (id: number, payload: Record<string, unknown>) =>
    apiRequest<BusinessCaseWithMetrics>(`/api/business-cases/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  getUxArtifacts: () => apiRequest<UxArtifact[]>('/api/ux-artifacts'),
  createUxArtifact: (payload: Record<string, unknown>) =>
    apiRequest<UxArtifact>('/api/ux-artifacts', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateUxArtifact: (id: number, payload: Record<string, unknown>) =>
    apiRequest<UxArtifact>(`/api/ux-artifacts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  getPmDocuments: () => apiRequest<PmDocument[]>('/api/pm-documents'),
  createPmDocument: (payload: Record<string, unknown>) =>
    apiRequest<PmDocument>('/api/pm-documents', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updatePmDocument: (id: number, payload: Record<string, unknown>) =>
    apiRequest<PmDocument>(`/api/pm-documents/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  queryAssistant: (task: string, prompt: string) =>
    apiRequest<{ mode: 'gemini' | 'local-fallback'; modelLabel: string; answer: string }>(
      '/api/assistant/query',
      {
        method: 'POST',
        body: JSON.stringify({ task, prompt }),
      }
    ),

  getDeliverables: () => apiRequest<DeliverableDoc[]>('/api/deliverables'),
};
