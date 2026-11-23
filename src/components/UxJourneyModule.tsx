import React, { useEffect, useState } from 'react';
import { Plus, Save } from 'lucide-react';
import { api } from '../lib/api';
import type { AuthUser, UxArtifact, UxArtifactType } from '../types/productpulse';

interface UxJourneyModuleProps {
  currentUser: AuthUser | null;
  onRequireAuth: () => void;
}

const TABS: Array<{ id: UxArtifactType; label: string }> = [
  { id: 'persona', label: 'User Personas' },
  { id: 'journey_stage', label: 'Customer Journey Map' },
  { id: 'pain_point', label: 'Pain-Point Tracker' },
  { id: 'user_story', label: 'User Stories & AC' },
];

export const UxJourneyModule: React.FC<UxJourneyModuleProps> = ({
  currentUser,
  onRequireAuth,
}) => {
  const [artifacts, setArtifacts] = useState<UxArtifact[]>([]);
  const [activeTab, setActiveTab] = useState<UxArtifactType>('persona');
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editSubtitle, setEditSubtitle] = useState('');
  const [editJsonText, setEditJsonText] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newSubtitle, setNewSubtitle] = useState('');
  const [newBody, setNewBody] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadArtifacts = async () => {
    setLoading(true);
    try {
      setArtifacts(await api.getUxArtifacts());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load UX artifacts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadArtifacts();
  }, []);

  const filtered = artifacts.filter((a) => a.type === activeTab);

  const startEdit = (item: UxArtifact) => {
    if (!currentUser) {
      onRequireAuth();
      return;
    }
    setEditingId(item.id);
    setEditTitle(item.title);
    setEditSubtitle(item.subtitle);
    setEditJsonText(JSON.stringify(item.content, null, 2));
    setError('');
  };

  const handleSaveEdit = async (e: React.FormEvent, id: number) => {
    e.preventDefault();
    setError('');
    try {
      const parsed = JSON.parse(editJsonText) as Record<string, unknown>;
      await api.updateUxArtifact(id, {
        title: editTitle,
        subtitle: editSubtitle,
        content: parsed,
      });
      setEditingId(null);
      setNotice('Updated UX artifact.');
      await loadArtifacts();
    } catch (err) {
      setError(
        err instanceof Error
          ? `Could not save (check JSON structure): ${err.message}`
          : 'Save failed.'
      );
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      onRequireAuth();
      return;
    }
    setError('');
    try {
      await api.createUxArtifact({
        type: activeTab,
        title: newTitle,
        subtitle: newSubtitle,
        content: {
          notes: newBody,
        },
        status: 'Active',
      });
      setNewTitle('');
      setNewSubtitle('');
      setNewBody('');
      setShowCreate(false);
      setNotice('Created new UX artifact.');
      await loadArtifacts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Creation failed.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            User Experience & Customer Journey
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Editable research templates for Personas, Journey Mapping, Pain Points, and User Stories (replace templates with verified research findings)
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
          Add {TABS.find((t) => t.id === activeTab)?.label}
        </button>
      </div>

      <div className="flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setActiveTab(t.id);
              setEditingId(null);
            }}
            className={`whitespace-nowrap rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors ${
              activeTab === t.id
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t.label} ({artifacts.filter((a) => a.type === t.id).length})
          </button>
        ))}
      </div>

      {notice && (
        <div className="rounded-lg border border-teal-200 bg-teal-50 px-4 py-2.5 text-xs text-teal-900">
          {notice}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs text-red-800">
          {error}
        </div>
      )}

      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="rounded-xl border border-slate-200 bg-white p-5 space-y-3"
        >
          <h2 className="text-sm font-semibold text-slate-900">
            Create New {TABS.find((t) => t.id === activeTab)?.label}
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <input
              type="text"
              required
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Title (e.g. Persona: Enterprise VP of Product)"
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            <input
              type="text"
              value={newSubtitle}
              onChange={(e) => setNewSubtitle(e.target.value)}
              placeholder="Subtitle / Segment / Sprint"
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <textarea
            rows={3}
            required
            value={newBody}
            onChange={(e) => setNewBody(e.target.value)}
            placeholder="Goals, frustrations, touchpoints, or acceptance criteria..."
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
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
              Save Artifact
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="h-64 animate-pulse rounded-xl border border-slate-200 bg-white" />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-slate-200 bg-white p-5"
            >
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
                <div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="font-medium text-purple-700">
                      {item.isTemplate ? 'Editable Template' : 'Custom Artifact'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{item.status}</span>
                  </div>
                  <h3 className="mt-1 text-base font-semibold text-slate-900">
                    {item.title}
                  </h3>
                  {item.subtitle && (
                    <p className="text-xs text-slate-500">{item.subtitle}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => startEdit(item)}
                  className="whitespace-nowrap rounded-lg border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Edit Template
                </button>
              </div>

              {editingId === item.id ? (
                <form
                  onSubmit={(e) => void handleSaveEdit(e, item.id)}
                  className="mt-4 space-y-3"
                >
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium"
                  />
                  <input
                    type="text"
                    value={editSubtitle}
                    onChange={(e) => setEditSubtitle(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs"
                  />
                  <textarea
                    rows={7}
                    value={editJsonText}
                    onChange={(e) => setEditJsonText(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 p-3 font-mono text-xs"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                    >
                      <Save className="h-3.5 w-3.5" />
                      Save Changes
                    </button>
                  </div>
                </form>
              ) : (
                <dl className="mt-4 space-y-2.5 text-xs">
                  {Object.entries(item.content).map(([k, v]) => (
                    <div key={k}>
                      <dt className="font-semibold capitalize text-slate-700">
                        {k.replace(/([A-Z])/g, ' $1')}
                      </dt>
                      <dd className="mt-0.5 text-slate-600">
                        {Array.isArray(v) ? (
                          <ul className="list-disc space-y-1 pl-4">
                            {v.map((entry, idx) => (
                              <li key={idx}>{String(entry)}</li>
                            ))}
                          </ul>
                        ) : (
                          String(v)
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
