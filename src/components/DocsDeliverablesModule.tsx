import React, { useEffect, useState } from 'react';
import { BookOpen, Download, Search } from 'lucide-react';
import { api, type DeliverableDoc } from '../lib/api';

export const DocsDeliverablesModule: React.FC = () => {
  const [docs, setDocs] = useState<DeliverableDoc[]>([]);
  const [selected, setSelected] = useState<DeliverableDoc | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getDeliverables()
      .then((list) => {
        setDocs(list);
        if (list.length > 0) setSelected(list[0]);
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = docs.filter((d) => {
    const matchesCat =
      categoryFilter === 'All' || d.category === categoryFilter;
    const matchesSearch =
      !search ||
      d.title.toLowerCase().includes(search.toLowerCase()) ||
      d.content.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const downloadMarkdown = (doc: DeliverableDoc) => {
    const blob = new Blob([doc.content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = doc.filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            PM Deliverables & Research Templates
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            16 Product Management portfolio documents and 4 structured user research templates from /docs/pm/
          </p>
        </div>

        <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
          {['All', 'PM Deliverable', 'Research Template'].map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategoryFilter(c)}
              className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                categoryFilter === c
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="h-72 animate-pulse rounded-xl border border-slate-200 bg-white" />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="space-y-3 lg:col-span-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter deliverables..."
                className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs"
              />
            </div>

            <div className="max-h-[620px] space-y-1.5 overflow-y-auto pr-1">
              {filtered.map((d) => (
                <button
                  key={d.filename}
                  type="button"
                  onClick={() => setSelected(d)}
                  className={`w-full rounded-lg border p-3 text-left transition-colors ${
                    selected?.filename === d.filename
                      ? 'border-blue-600 bg-blue-50/60'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="text-[11px] font-medium text-teal-700">
                    {d.category}
                  </div>
                  <div className="mt-0.5 text-xs font-semibold text-slate-900">
                    {d.title}
                  </div>
                  <div className="mt-0.5 font-mono text-[10px] text-slate-400">
                    {d.filename}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-8">
            {selected ? (
              <div>
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <BookOpen className="h-3.5 w-3.5 text-blue-600" />
                      <span>{selected.category}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono">{selected.filename}</span>
                    </div>
                    <h2 className="mt-1 text-xl font-semibold text-slate-900">
                      {selected.title}
                    </h2>
                  </div>

                  <button
                    type="button"
                    onClick={() => downloadMarkdown(selected)}
                    className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download .md
                  </button>
                </div>

                <pre className="mt-4 whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-700">
                  {selected.content}
                </pre>
              </div>
            ) : (
              <p className="text-sm text-slate-500">Select a deliverable to view.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
