import React, { useEffect, useState } from 'react';
import { FileText, Plus, Save } from 'lucide-react';
import { api } from '../lib/api';
import type {
  AuthUser,
  MoscowPriority,
  PmDocType,
  PmDocument,
} from '../types/productpulse';

interface PmWorkspaceModuleProps {
  currentUser: AuthUser | null;
  onRequireAuth: () => void;
}

const DOC_TYPES: Array<{ id: 'all' | PmDocType; label: string }> = [
  { id: 'all', label: 'All Artifacts' },
  { id: 'prd', label: 'PRDs' },
  { id: 'goal', label: 'Goals & OKRs' },
  { id: 'strategy', label: 'Vision & Strategy' },
  { id: 'sprint_note', label: 'Sprint Planning' },
  { id: 'release_note', label: 'Release Notes' },
];

export const PmWorkspaceModule: React.FC<PmWorkspaceModuleProps> = ({
  currentUser,
  onRequireAuth,
}) => {
  const [docs, setDocs] = useState<PmDocument[]>([]);
  const [filterType, setFilterType] = useState<'all' | PmDocType>('all');
  const [selectedDoc, setSelectedDoc] = useState<PmDocument | null>(null);
  const [editing, setEditing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  // Edit / create fields
  const [docType, setDocType] = useState<PmDocType>('prd');
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState('Draft');
  const [moscow, setMoscow] = useState<MoscowPriority>('Must Have');
  const [sprint, setSprint] = useState('Sprint 14');
  const [content, setContent] = useState('');

  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const loadDocs = async () => {
    const list = await api.getPmDocuments();
    setDocs(list);
    if (list.length > 0 && !selectedDoc) {
      setSelectedDoc(list[0]);
    }
  };

  useEffect(() => {
    void loadDocs();
  }, []);

  const filtered =
    filterType === 'all' ? docs : docs.filter((d) => d.docType === filterType);

  const openEditor = (doc: PmDocument) => {
    if (!currentUser) {
      onRequireAuth();
      return;
    }
    setSelectedDoc(doc);
    setTitle(doc.title);
    setStatus(doc.status);
    setMoscow(doc.moscow);
    setSprint(doc.sprint);
    setContent(doc.content);
    setEditing(true);
    setShowCreate(false);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoc) return;
    setError('');
    try {
      const updated = await api.updatePmDocument(selectedDoc.id, {
        title,
        status,
        moscow,
        sprint,
        content,
      });
      setSelectedDoc(updated);
      setEditing(false);
      setNotice(`Saved "${updated.title}".`);
      await loadDocs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed.');
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
      const created = await api.createPmDocument({
        docType,
        title,
        status,
        moscow,
        sprint,
        content,
      });
      setSelectedDoc(created);
      setShowCreate(false);
      setNotice(`Created "${created.title}".`);
      await loadDocs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Creation failed.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Product Management Workspace
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            PRDs, Product Vision & Strategy, Goals/OKRs, Agile Sprint Planning, and MoSCoW prioritization
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            if (!currentUser) {
              onRequireAuth();
              return;
            }
            setTitle('');
            setContent('## Context\n\n## Goals\n\n## Requirements (MoSCoW)\n');
            setShowCreate(true);
            setEditing(false);
          }}
          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-700"
        >
          <Plus className="h-3.5 w-3.5" />
          New Document
        </button>
      </div>

      <div className="flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1">
        {DOC_TYPES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setFilterType(t.id)}
            className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              filterType === t.id
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t.label}
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-2 lg:col-span-4">
          {filtered.map((doc) => (
            <button
              key={doc.id}
              type="button"
              onClick={() => {
                setSelectedDoc(doc);
                setEditing(false);
                setShowCreate(false);
              }}
              className={`w-full rounded-xl border p-4 text-left transition-colors ${
                selectedDoc?.id === doc.id && !showCreate
                  ? 'border-blue-600 bg-blue-50/50'
                  : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span className="uppercase tracking-wider font-semibold text-blue-700">
                  {doc.docType.replace('_', ' ')}
                </span>
                <span>{doc.moscow}</span>
              </div>
              <div className="mt-1 text-sm font-semibold text-slate-900">
                {doc.title}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                {doc.sprint} · {doc.status} · {doc.owner}
              </div>
            </button>
          ))}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-8">
          {showCreate ? (
            <form onSubmit={handleCreate} className="space-y-4">
              <h2 className="text-base font-semibold text-slate-900">
                Create Workspace Document
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value as PmDocType)}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs"
                >
                  <option value="prd">PRD</option>
                  <option value="goal">Goal / OKR</option>
                  <option value="strategy">Strategy</option>
                  <option value="sprint_note">Sprint Note</option>
                  <option value="release_note">Release Note</option>
                </select>
                <select
                  value={moscow}
                  onChange={(e) => setMoscow(e.target.value as MoscowPriority)}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs"
                >
                  <option value="Must Have">Must Have</option>
                  <option value="Should Have">Should Have</option>
                  <option value="Could Have">Could Have</option>
                  <option value="Won't Have">Won't Have</option>
                </select>
                <input
                  type="text"
                  value={sprint}
                  onChange={(e) => setSprint(e.target.value)}
                  placeholder="Sprint 14"
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs"
                />
              </div>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Document title..."
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium"
              />
              <textarea
                rows={12}
                required
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full rounded-lg border border-slate-200 p-3 font-mono text-xs"
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
                  Create Document
                </button>
              </div>
            </form>
          ) : editing && selectedDoc ? (
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <input
                  type="text"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  placeholder="Status"
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs"
                />
                <select
                  value={moscow}
                  onChange={(e) => setMoscow(e.target.value as MoscowPriority)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs"
                >
                  <option value="Must Have">Must Have</option>
                  <option value="Should Have">Should Have</option>
                  <option value="Could Have">Could Have</option>
                  <option value="Won't Have">Won't Have</option>
                </select>
                <input
                  type="text"
                  value={sprint}
                  onChange={(e) => setSprint(e.target.value)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs"
                />
              </div>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-base font-semibold"
              />
              <textarea
                rows={14}
                required
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full rounded-lg border border-slate-200 p-3 font-mono text-xs"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                >
                  <Save className="h-3.5 w-3.5" />
                  Save Changes
                </button>
              </div>
            </form>
          ) : selectedDoc ? (
            <div>
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
                <div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <FileText className="h-3.5 w-3.5 text-blue-600" />
                    <span className="font-semibold text-slate-700">
                      {selectedDoc.docType.toUpperCase()}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{selectedDoc.moscow}</span>
                    <span aria-hidden="true">·</span>
                    <span>{selectedDoc.sprint}</span>
                    <span aria-hidden="true">·</span>
                    <span>{selectedDoc.status}</span>
                  </div>
                  <h2 className="mt-1 text-xl font-semibold text-slate-900">
                    {selectedDoc.title}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => openEditor(selectedDoc)}
                  className="whitespace-nowrap rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Edit Document
                </button>
              </div>
              <pre className="mt-4 whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-700">
                {selectedDoc.content}
              </pre>
            </div>
          ) : (
            <p className="text-sm text-slate-500">Select or create a document.</p>
          )}
        </div>
      </div>
    </div>
  );
};
