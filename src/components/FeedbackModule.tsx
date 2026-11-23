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
import { Plus, RefreshCw, Search, Sparkles, Trash2, Upload } from 'lucide-react';
import { api, type FeedbackInsightsResponse } from '../lib/api';
import type {
  AuthUser,
  FeedbackCategory,
  FeedbackItem,
  FeedbackStatus,
} from '../types/productpulse';

const CATEGORIES: Array<'All' | FeedbackCategory> = [
  'All',
  'Feature Requests',
  'Bug Reports',
  'Usability Issues',
  'Performance Issues',
  'General Suggestions',
];

const STATUSES: Array<'All' | FeedbackStatus> = [
  'All',
  'New',
  'Under Review',
  'Planned',
  'Resolved',
  'Archived',
];

const SAMPLE_CSV = `title,content,customer_segment,category,rating
"Batch export progress bar missing","When exporting 20k rows there is no progress indicator so users click export twice.","Enterprise","Usability Issues",3
"Add weekly Slack digest for CSAT drops","Would love an automated Monday Slack summary when CSAT dips below 4.2.","Mid-Market","Feature Requests",4`;

interface FeedbackModuleProps {
  initialView?: 'queue' | 'insights';
  currentUser: AuthUser | null;
  onRequireAuth: () => void;
  onPromoteToFeature: (prefill: { title: string; description: string }) => void;
}

export const FeedbackModule: React.FC<FeedbackModuleProps> = ({
  initialView = 'queue',
  currentUser,
  onRequireAuth,
  onPromoteToFeature,
}) => {
  const [subView, setSubView] = useState<'queue' | 'insights'>(initialView);
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [insights, setInsights] = useState<FeedbackInsightsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [sentimentFilter, setSentimentFilter] = useState<string>('All');

  const [showSubmit, setShowSubmit] = useState(false);
  const [showCsv, setShowCsv] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [segment, setSegment] = useState('Mid-Market');
  const [category, setCategory] = useState<string>('Auto-Detect');
  const [rating, setRating] = useState('4');
  const [csvText, setCsvText] = useState(SAMPLE_CSV);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setSubView(initialView);
  }, [initialView]);

  const loadAll = async () => {
    setLoading(true);
    setError('');
    try {
      const [list, ins] = await Promise.all([
        api.getFeedback({
          search,
          category: categoryFilter,
          status: statusFilter,
          sentiment: sentimentFilter,
        }),
        api.getFeedbackInsights(),
      ]);
      setItems(list);
      setInsights(ins);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load feedback.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
  }, [search, categoryFilter, statusFilter, sentimentFilter]);

  const handleSubmitFeedback = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      onRequireAuth();
      return;
    }
    setSubmitting(true);
    setError('');
    setNotice('');
    try {
      const created = await api.createFeedback({
        title,
        content,
        customerSegment: segment,
        category: category === 'Auto-Detect' ? undefined : category,
        rating: Number(rating),
      });
      setTitle('');
      setContent('');
      setShowSubmit(false);
      setNotice(
        `Submitted "${created.title}" — classified as ${created.sentiment} (${created.analysisMethod}).`
      );
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCsvImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      onRequireAuth();
      return;
    }
    setSubmitting(true);
    setError('');
    setNotice('');
    try {
      const result = await api.importFeedbackCsv(csvText);
      setShowCsv(false);
      setNotice(
        `Imported ${result.importedCount} feedback rows.${
          result.errors.length > 0 ? ` Skipped ${result.errors.length} invalid rows.` : ''
        }`
      );
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'CSV import failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCsvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setCsvText(reader.result);
      }
    };
    reader.readAsText(file);
  };

  const handleUpdateItem = async (
    id: number,
    patch: Partial<{ status: FeedbackStatus; category: FeedbackCategory }>
  ) => {
    if (!currentUser) {
      onRequireAuth();
      return;
    }
    try {
      await api.updateFeedback(id, patch);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed.');
    }
  };

  const handleReanalyze = async (id: number) => {
    if (!currentUser) {
      onRequireAuth();
      return;
    }
    try {
      await api.reanalyzeFeedback(id);
      setNotice('Re-ran AI classification with current active engine.');
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Re-analysis failed.');
    }
  };

  const handleDelete = async (id: number) => {
    if (!currentUser || currentUser.role !== 'admin') {
      setError('Admin role required to delete feedback items.');
      return;
    }
    try {
      await api.deleteFeedback(id);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            {subView === 'queue'
              ? 'Customer Feedback Management'
              : 'AI-Powered Feedback Analysis'}
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            {insights?.geminiConfigured
              ? 'Gemini 4 Hydrogen + Transparent Explanation Engine'
              : 'Local Deterministic NLP Engine (Active — works without API key)'}
            <span aria-hidden="true"> · </span>
            <span>Automated classifications are triage aids, not verified customer facts</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setSubView('queue')}
              className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                subView === 'queue'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Feedback Queue ({items.length})
            </button>
            <button
              type="button"
              onClick={() => setSubView('insights')}
              className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                subView === 'insights'
                  ? 'bg-white text-purple-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              AI Insights & Clusters
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              if (!currentUser) onRequireAuth();
              else {
                setShowCsv((v) => !v);
                setShowSubmit(false);
              }
            }}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <Upload className="h-3.5 w-3.5" />
            Import CSV
          </button>

          <button
            type="button"
            onClick={() => {
              if (!currentUser) onRequireAuth();
              else {
                setShowSubmit((v) => !v);
                setShowCsv(false);
              }
            }}
            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700"
          >
            <Plus className="h-3.5 w-3.5" />
            Submit Feedback
          </button>
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

      {/* Submit Feedback Form */}
      {showSubmit && (
        <form
          onSubmit={handleSubmitFeedback}
          className="rounded-xl border border-slate-200 bg-white p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">
              Submit Customer Feedback
            </h2>
            <button
              type="button"
              onClick={() => setShowSubmit(false)}
              className="text-xs text-slate-500 hover:text-slate-800"
            >
              Cancel
            </button>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-700">Title</label>
              <input
                type="text"
                required
                minLength={3}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Export button freezes on Safari"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">
                Customer Segment
              </label>
              <select
                value={segment}
                onChange={(e) => setSegment(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="Enterprise">Enterprise</option>
                <option value="Mid-Market">Mid-Market</option>
                <option value="SMB">SMB</option>
                <option value="Startup">Startup</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">
                Rating (1-5)
              </label>
              <select
                value={rating}
                onChange={(e) => setRating(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="5">5 - Very Satisfied</option>
                <option value="4">4 - Satisfied</option>
                <option value="3">3 - Neutral</option>
                <option value="2">2 - Dissatisfied</option>
                <option value="1">1 - Critical Issue</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div className="md:col-span-3">
              <label className="block text-xs font-medium text-slate-700">
                Feedback Description
              </label>
              <textarea
                required
                minLength={5}
                rows={3}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Describe the customer request, bug reproduction, or usability observation..."
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="Auto-Detect">Auto-Detect via NLP</option>
                {CATEGORIES.filter((c) => c !== 'All').map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="whitespace-nowrap rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? 'Analyzing & Saving...' : 'Analyze & Save Feedback'}
            </button>
          </div>
        </form>
      )}

      {/* CSV Import Form */}
      {showCsv && (
        <form
          onSubmit={handleCsvImport}
          className="rounded-xl border border-slate-200 bg-white p-5 space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Bulk Import Feedback via CSV
              </h2>
              <p className="text-xs text-slate-500">
                Required headers: title, content. Optional: customer_segment, category, rating (1-5).
              </p>
            </div>
            <label className="cursor-pointer rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
              Upload .csv File
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleCsvFileUpload}
                className="hidden"
              />
            </label>
          </div>
          <textarea
            rows={5}
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            className="w-full rounded-lg border border-slate-200 p-3 font-mono text-xs text-slate-800"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowCsv(false)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-purple-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
            >
              {submitting ? 'Importing & Running NLP...' : 'Run CSV Import'}
            </button>
          </div>
        </form>
      )}

      {subView === 'insights' && insights ? (
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2 text-purple-700">
              <Sparkles className="h-4 w-4" />
              <h2 className="text-base font-semibold text-slate-900">
                Automated Feedback Synthesis ({insights.totalAnalyzed} items)
              </h2>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-slate-700">
              {insights.summary}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h3 className="text-sm font-semibold text-slate-900">
                Topic Frequency Distribution
              </h3>
              <p className="mb-4 text-xs text-slate-500">
                Detected via rule-based topic taxonomy and keyword matching
              </p>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={insights.topicBreakdown}
                    layout="vertical"
                    margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#64748B' }} />
                    <YAxis
                      dataKey="topic"
                      type="category"
                      width={150}
                      tick={{ fontSize: 11, fill: '#334155' }}
                    />
                    <Tooltip />
                    <Bar dataKey="count" name="Mentions" fill="#0D9488" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h3 className="text-sm font-semibold text-slate-900">
                Top Extracted Keywords & Feature Requests
              </h3>
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {insights.topKeywords.map((kw) => (
                  <div
                    key={kw.keyword}
                    className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs"
                  >
                    <span className="font-medium text-slate-800">{kw.keyword}</span>
                    <span className="font-mono text-slate-500 tabular-nums">{kw.count}</span>
                  </div>
                ))}
              </div>
              <div className="mt-5 border-t border-slate-100 pt-4">
                <h4 className="text-xs font-semibold text-slate-700">
                  Identified Feature Requests
                </h4>
                <ul className="mt-2 space-y-1.5 text-xs text-slate-600">
                  {insights.topFeatureRequests.map((req) => (
                    <li key={req} className="flex items-start gap-2">
                      <span className="text-blue-600">-</span>
                      <span>{req}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-slate-900">
              Recurring Complaint Clusters
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Negative or issue-classified feedback grouped by primary topic. Convert high-impact clusters directly into RICE proposals.
            </p>
            <div className="mt-4 divide-y divide-slate-100">
              {insights.recurringComplaints.map((cluster) => (
                <div
                  key={cluster.topic}
                  className="flex flex-wrap items-center justify-between gap-4 py-3.5"
                >
                  <div className="max-w-2xl">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <span>{cluster.topic}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono text-xs text-red-700 tabular-nums">
                        {cluster.count} reports
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono text-xs text-slate-500 tabular-nums">
                        Avg rating {cluster.avgRating}/5
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      Keywords: {cluster.topKeywords.join(', ')} · Examples:{' '}
                      {cluster.sampleTitles.join(' | ')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onPromoteToFeature({
                        title: `Resolve ${cluster.topic} Friction`,
                        description: `Addresses ${cluster.count} recurring customer reports (${cluster.sampleTitles.join('; ')}).`,
                      })
                    }
                    className="whitespace-nowrap rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
                  >
                    Create RICE Proposal
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search feedback title, body, or keywords..."
                className="w-full rounded-lg border border-slate-200 py-1.5 pl-9 pr-3 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <select
              aria-label="Filter by category"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  Category: {c}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  Status: {s}
                </option>
              ))}
            </select>

            <select
              aria-label="Filter by sentiment"
              value={sentimentFilter}
              onChange={(e) => setSentimentFilter(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700"
            >
              <option value="All">Sentiment: All</option>
              <option value="positive">Positive</option>
              <option value="neutral">Neutral</option>
              <option value="negative">Negative</option>
            </select>
          </div>

          {/* Feedback List */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            {loading ? (
              <div className="p-8 text-center text-xs text-slate-500">
                Loading feedback records...
              </div>
            ) : items.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                No feedback items match the active filters.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {items.map((item) => (
                  <div key={item.id} className="p-5 hover:bg-slate-50/70">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span className="font-medium text-slate-700">
                            {item.customerSegment}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span
                            className={`font-semibold ${
                              item.sentiment === 'positive'
                                ? 'text-teal-700'
                                : item.sentiment === 'negative'
                                ? 'text-red-700'
                                : 'text-slate-600'
                            }`}
                          >
                            Sentiment: {item.sentiment} ({item.sentimentScore})
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">
                            Rating {item.rating}/5
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{item.createdAt.slice(0, 10)}</span>
                          {item.isSynthetic && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="text-amber-700">Synthetic Demo</span>
                            </>
                          )}
                        </div>

                        <h3 className="mt-1.5 text-sm font-semibold text-slate-900">
                          {item.title}
                        </h3>
                        <p className="mt-1 text-sm text-slate-600">{item.content}</p>

                        <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span>Topics: {item.topics.join(', ')}</span>
                          <span aria-hidden="true">·</span>
                          <span>Keywords: {item.keywords.join(', ')}</span>
                        </div>

                        <p className="mt-2 rounded-md bg-slate-50 px-3 py-1.5 text-xs text-slate-600">
                          <span className="font-medium text-slate-800">
                            Analysis ({item.analysisMethod}):
                          </span>{' '}
                          {item.analysisExplanation}
                        </p>
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <select
                          aria-label={`Category for ${item.title}`}
                          value={item.category}
                          onChange={(e) =>
                            void handleUpdateItem(item.id, {
                              category: e.target.value as FeedbackCategory,
                            })
                          }
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700"
                        >
                          {CATEGORIES.filter((c) => c !== 'All').map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>

                        <select
                          aria-label={`Status for ${item.title}`}
                          value={item.status}
                          onChange={(e) =>
                            void handleUpdateItem(item.id, {
                              status: e.target.value as FeedbackStatus,
                            })
                          }
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700"
                        >
                          {STATUSES.filter((s) => s !== 'All').map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => void handleReanalyze(item.id)}
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100"
                            title="Re-run NLP analysis"
                          >
                            <RefreshCw className="h-3 w-3" />
                            Re-analyze
                          </button>
                          {currentUser?.role === 'admin' && (
                            <button
                              type="button"
                              onClick={() => void handleDelete(item.id)}
                              className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                              title="Delete item (Admin)"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
