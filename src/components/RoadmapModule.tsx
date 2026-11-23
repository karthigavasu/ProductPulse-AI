import React, { useEffect, useState } from 'react';
import { Calendar, Columns3 } from 'lucide-react';
import { api } from '../lib/api';
import type { AuthUser, ProductFeature, RoadmapStatus } from '../types/productpulse';

const COLUMNS: RoadmapStatus[] = [
  'Backlog',
  'Planned',
  'In Progress',
  'Testing',
  'Released',
];

interface RoadmapModuleProps {
  currentUser: AuthUser | null;
  onRequireAuth: () => void;
}

export const RoadmapModule: React.FC<RoadmapModuleProps> = ({
  currentUser,
  onRequireAuth,
}) => {
  const [features, setFeatures] = useState<ProductFeature[]>([]);
  const [view, setView] = useState<'kanban' | 'timeline'>('kanban');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadFeatures = async () => {
    setLoading(true);
    try {
      setFeatures(await api.getFeatures());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load roadmap.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadFeatures();
  }, []);

  const updateStatus = async (id: number, roadmapStatus: RoadmapStatus) => {
    if (!currentUser) {
      onRequireAuth();
      return;
    }
    setError('');
    try {
      await api.updateFeature(id, { roadmapStatus });
      await loadFeatures();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Status update failed.');
    }
  };

  const milestones = Array.from(
    new Set(features.map((f) => f.milestone || 'Unassigned Milestone'))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Product Roadmap Management
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Initiatives, MVP scope (Must Have), release milestones, and sprint execution across 5 lifecycle stages
          </p>
        </div>

        <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setView('kanban')}
            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              view === 'kanban'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Columns3 className="h-3.5 w-3.5" />
            Kanban Board
          </button>
          <button
            type="button"
            onClick={() => setView('timeline')}
            className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              view === 'timeline'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Calendar className="h-3.5 w-3.5" />
            Timeline & Milestones
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-800">
          {error}
        </div>
      )}

      {loading ? (
        <div className="h-80 animate-pulse rounded-xl border border-slate-200 bg-white" />
      ) : view === 'kanban' ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-5">
          {COLUMNS.map((col) => {
            const colItems = features.filter((f) => f.roadmapStatus === col);
            return (
              <div
                key={col}
                className="flex flex-col rounded-xl border border-slate-200 bg-slate-50/70 p-3"
              >
                <div className="mb-3 flex items-center justify-between border-b border-slate-200 pb-2">
                  <h2 className="text-xs font-semibold text-slate-800">{col}</h2>
                  <span className="font-mono text-xs text-slate-500 tabular-nums">
                    {colItems.length}
                  </span>
                </div>

                <div className="space-y-2.5">
                  {colItems.length === 0 ? (
                    <p className="py-6 text-center text-xs text-slate-400">
                      No items in {col}
                    </p>
                  ) : (
                    colItems.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-lg border border-slate-200 bg-white p-3"
                      >
                        <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
                          <span className="truncate font-medium text-blue-700">
                            {item.initiative}
                          </span>
                          <span className="font-mono font-semibold text-slate-700 tabular-nums">
                            RICE {item.riceScore}
                          </span>
                        </div>

                        <h3 className="mt-1 text-xs font-semibold text-slate-900">
                          {item.title}
                        </h3>

                        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                          <span>{item.moscowPriority}</span>
                          <span aria-hidden="true">·</span>
                          <span>{item.sprint || 'Unscheduled'}</span>
                        </div>

                        {item.targetReleaseDate && (
                          <div className="mt-1 font-mono text-[11px] text-slate-500">
                            Target: {item.targetReleaseDate}
                          </div>
                        )}

                        <div className="mt-2.5 border-t border-slate-100 pt-2">
                          <select
                            aria-label={`Move ${item.title} status`}
                            value={item.roadmapStatus}
                            onChange={(e) =>
                              void updateStatus(
                                item.id,
                                e.target.value as RoadmapStatus
                              )
                            }
                            className="w-full rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-700"
                          >
                            {COLUMNS.map((statusOption) => (
                              <option key={statusOption} value={statusOption}>
                                Move to: {statusOption}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-4">
          {milestones.map((ms) => {
            const msItems = features
              .filter((f) => (f.milestone || 'Unassigned Milestone') === ms)
              .sort((a, b) =>
                (a.targetReleaseDate || '9999').localeCompare(
                  b.targetReleaseDate || '9999'
                )
              );
            const releasedCount = msItems.filter(
              (f) => f.roadmapStatus === 'Released'
            ).length;
            const progressPct =
              msItems.length > 0
                ? Math.round((releasedCount / msItems.length) * 100)
                : 0;

            return (
              <div
                key={ms}
                className="rounded-xl border border-slate-200 bg-white p-5"
              >
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-3">
                  <div>
                    <h2 className="text-base font-semibold text-slate-900">{ms}</h2>
                    <p className="text-xs text-slate-500">
                      {msItems.length} features · {releasedCount} released ({progressPct}% complete)
                    </p>
                  </div>
                  <div className="h-2 w-48 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full bg-teal-600 transition-all"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>

                <div className="mt-3 divide-y divide-slate-100">
                  {msItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-wrap items-center justify-between gap-4 py-2.5 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-slate-900">
                          {item.title}
                        </div>
                        <div className="mt-0.5 text-slate-500">
                          {item.initiative} · Owner: {item.owner} · {item.moscowPriority}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 font-mono text-slate-600 tabular-nums">
                        <span>{item.sprint || 'TBD'}</span>
                        <span>{item.targetReleaseDate || 'Unscheduled'}</span>
                        <span className="font-sans font-semibold text-blue-700">
                          {item.roadmapStatus}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
