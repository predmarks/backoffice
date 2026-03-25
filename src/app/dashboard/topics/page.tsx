'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';

interface TopicData {
  id: string;
  name: string;
  slug: string;
  summary: string;
  suggestedAngles: string[];
  category: string;
  score: number;
  status: string;
  signalCount: number;
  lastSignalAt: string | null;
  lastGeneratedAt: string | null;
}

function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(new Date(dateStr));
}

export default function TopicsPage() {
  const [topics, setTopics] = useState<TopicData[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissing, setDismissing] = useState<string | null>(null);
  const [dismissPromptId, setDismissPromptId] = useState<string | null>(null);
  const [dismissReason, setDismissReason] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [generatingSingle, setGeneratingSingle] = useState<string | null>(null);
  const [count, setCount] = useState(10);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestDesc, setSuggestDesc] = useState('');
  const [suggestSending, setSuggestSending] = useState(false);
  const [suggestMsg, setSuggestMsg] = useState<string | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchTopics = useCallback(async () => {
    try {
      const res = await fetch('/api/topics');
      if (res.ok) {
        const data = await res.json();
        setTopics(data.topics ?? []);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchTopics().finally(() => setLoading(false));
  }, [fetchTopics]);

  // Poll every 5s while any topic is researching
  useEffect(() => {
    const hasResearching = topics.some((t) => t.status === 'researching');
    if (hasResearching && !pollRef.current) {
      pollRef.current = setInterval(fetchTopics, 5000);
    } else if (!hasResearching && pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [topics, fetchTopics]);

  function openDismissPrompt(topicId: string) {
    setDismissPromptId(topicId);
    setDismissReason('');
  }

  async function handleDismiss() {
    if (!dismissPromptId || !dismissReason.trim()) return;
    const topicId = dismissPromptId;
    setDismissing(topicId);
    setDismissPromptId(null);
    try {
      const res = await fetch(`/api/topics/${topicId}/dismiss`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: dismissReason.trim() }),
      });
      if (res.ok) {
        setTopics((prev) => prev.filter((t) => t.id !== topicId));
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(topicId);
          return next;
        });
      }
    } catch {
      // ignore
    } finally {
      setDismissing(null);
      setDismissReason('');
    }
  }

  function toggleSelect(topicId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(topicId)) {
        next.delete(topicId);
      } else {
        next.add(topicId);
      }
      return next;
    });
  }

  const selectableTopics = topics.filter((t) => t.status !== 'researching');

  function toggleSelectAll() {
    if (selectedIds.size === selectableTopics.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectableTopics.map((t) => t.id)));
    }
  }

  async function handleGenerateBulk() {
    if (selectedIds.size === 0) return;
    setGenerating(true);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicIds: Array.from(selectedIds), count }),
      });
      if (!res.ok) throw new Error('Failed');
    } catch {
      // ignore
    } finally {
      setGenerating(false);
    }
  }

  async function handleGenerateSingle(topicId: string) {
    setGeneratingSingle(topicId);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicIds: [topicId], count: 1 }),
      });
      if (!res.ok) throw new Error('Failed');
    } catch {
      // ignore
    } finally {
      setGeneratingSingle(null);
    }
  }

  async function handleSuggest(e: React.FormEvent) {
    e.preventDefault();
    if (!suggestDesc.trim()) return;
    setSuggestSending(true);
    setSuggestMsg(null);
    try {
      const res = await fetch('/api/topics/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: suggestDesc.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        setSuggestMsg(`Error: ${data.error || 'Error al enviar'}`);
      } else {
        setSuggestMsg(null);
        setSuggestDesc('');
        await fetchTopics();
      }
    } catch {
      setSuggestMsg('Error de conexión');
    } finally {
      setSuggestSending(false);
    }
  }

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  function toggleExpand(topicId: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(topicId)) {
        next.delete(topicId);
      } else {
        next.add(topicId);
      }
      return next;
    });
  }

  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  const CATEGORIES = ['Política', 'Economía', 'Deportes', 'Entretenimiento', 'Clima'];

  const filteredTopics = categoryFilter
    ? topics.filter((t) => t.category === categoryFilter || t.status === 'researching')
    : topics;

  const categoryCounts = CATEGORIES.reduce<Record<string, number>>((acc, cat) => {
    acc[cat] = topics.filter((t) => t.category === cat && t.status !== 'researching').length;
    return acc;
  }, {});

  const isGenerating = generating || generatingSingle !== null;
  const allSelected = selectableTopics.length > 0 && selectedIds.size === selectableTopics.length;

  return (
    <div className="space-y-6">
      {/* Sugerir tema */}
      <div className="border border-gray-200 rounded-lg bg-white">
        <button
          onClick={() => setSuggestOpen(!suggestOpen)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
        >
          Sugerir tema
          <span className="text-[10px]">{suggestOpen ? '\u25B2' : '\u25BC'}</span>
        </button>
        {suggestOpen && (
          <form onSubmit={handleSuggest} className="px-4 pb-4 space-y-3 border-t border-gray-100">
            <div className="pt-3">
              <textarea
                value={suggestDesc}
                onChange={(e) => setSuggestDesc(e.target.value)}
                rows={2}
                disabled={suggestSending}
                placeholder="Describí el tema que querés explorar..."
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none disabled:opacity-50"
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={suggestSending || !suggestDesc.trim()}
                className="px-4 py-1.5 text-sm font-medium rounded-md bg-gray-800 hover:bg-gray-900 text-white disabled:opacity-50 transition-colors cursor-pointer"
              >
                {suggestSending ? 'Investigando...' : 'Investigar'}
              </button>
            </div>
            {suggestMsg && (
              <p className={`text-sm ${suggestMsg.startsWith('Error') ? 'text-red-600' : 'text-green-600'}`}>
                {suggestMsg}
              </p>
            )}
          </form>
        )}
      </div>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Temas</h1>
        {topics.length > 0 && (
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleSelectAll}
              className="rounded border-gray-300"
            />
            Seleccionar todos
          </label>
        )}
      </div>

      {/* Category filters */}
      {topics.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setCategoryFilter(null)}
            className={`px-3 py-1 text-xs rounded-full border transition-colors cursor-pointer ${
              categoryFilter === null
                ? 'bg-gray-800 text-white border-gray-800'
                : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
            }`}
          >
            Todos ({topics.filter((t) => t.status !== 'researching').length})
          </button>
          {CATEGORIES.map((cat) => {
            const count = categoryCounts[cat];
            if (count === 0) return null;
            return (
              <button
                key={cat}
                onClick={() => setCategoryFilter(categoryFilter === cat ? null : cat)}
                className={`px-3 py-1 text-xs rounded-full border transition-colors cursor-pointer ${
                  categoryFilter === cat
                    ? 'bg-gray-800 text-white border-gray-800'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                }`}
              >
                {cat} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
          <span className="text-sm text-blue-700 font-medium">
            {selectedIds.size} tema{selectedIds.size !== 1 ? 's' : ''} seleccionado{selectedIds.size !== 1 ? 's' : ''}
          </span>
          <div className="flex items-center gap-2 ml-auto">
            <input
              type="number"
              min={1}
              max={50}
              value={count}
              onChange={(e) => setCount(Math.min(50, Math.max(1, Number(e.target.value) || 1)))}
              disabled={isGenerating}
              className="w-16 px-2 py-1.5 text-sm border border-blue-300 rounded-md text-center disabled:opacity-50"
            />
            <button
              onClick={handleGenerateBulk}
              disabled={isGenerating}
              className="px-4 py-1.5 text-sm font-medium rounded-md bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 transition-colors"
            >
              {generating
                ? 'Generando...'
                : `Generar ${count} mercado${count !== 1 ? 's' : ''} desde ${selectedIds.size} tema${selectedIds.size !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      )}

      {loading && (
        <div className="text-sm text-gray-500">Cargando...</div>
      )}

      {!loading && topics.length === 0 && (
        <div className="text-sm text-gray-500">No hay temas activos</div>
      )}

      <div className="grid gap-1">
        {filteredTopics.map((t) => {
          const isResearching = t.status === 'researching';
          const hasNewInfo = t.lastSignalAt && t.lastGeneratedAt && t.lastSignalAt > t.lastGeneratedAt;
          const isStale = t.status === 'stale';
          const isSelected = selectedIds.has(t.id);
          const isExpanded = expandedIds.has(t.id);

          return (
            <div
              key={t.id}
              className={`bg-white border rounded-lg ${
                isResearching
                  ? 'border-purple-300 bg-purple-50/30'
                  : isSelected
                  ? 'border-blue-400 ring-1 ring-blue-200'
                  : isStale
                  ? 'border-gray-200 bg-gray-50'
                  : 'border-gray-200'
              }`}
            >
              {/* Header row — always visible */}
              <div className="flex items-center gap-2 px-3 py-2">
                {isResearching ? (
                  <span className="w-4 h-4 flex items-center justify-center shrink-0">
                    <span className="block w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                  </span>
                ) : (
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelect(t.id)}
                    className="rounded border-gray-300 shrink-0"
                  />
                )}
                {!isResearching && (
                  <span
                    className={`px-1.5 py-0.5 rounded text-xs font-mono shrink-0 ${
                      t.score >= 7
                        ? 'bg-green-100 text-green-700'
                        : t.score >= 4
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {t.score.toFixed(1)}
                  </span>
                )}
                <span
                  className={`px-1.5 py-0.5 rounded text-xs font-medium shrink-0 ${
                    isResearching
                      ? 'bg-purple-100 text-purple-600 animate-pulse'
                      : isStale
                      ? 'bg-orange-100 text-orange-600'
                      : 'bg-green-100 text-green-600'
                  }`}
                >
                  {isResearching ? 'investigando...' : isStale ? 'inactivo' : 'activo'}
                </span>
                {hasNewInfo && !isResearching && (
                  <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700 shrink-0">
                    nueva info
                  </span>
                )}
                {isResearching ? (
                  <span className="text-sm text-gray-500 truncate">{t.name}</span>
                ) : (
                  <Link
                    href={`/dashboard/topics/${t.slug}`}
                    className="text-sm font-medium text-gray-800 hover:text-blue-600 truncate transition-colors"
                  >
                    {t.name}
                  </Link>
                )}
                {!isResearching && (
                  <span className="text-xs text-gray-400 shrink-0">{t.category}</span>
                )}
                <div className="ml-auto flex items-center gap-2 shrink-0">
                  {!isResearching && (
                    <>
                      <button
                        onClick={() => handleGenerateSingle(t.id)}
                        disabled={isGenerating}
                        className="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50 cursor-pointer"
                        title="Generar 1 mercado desde este tema"
                      >
                        {generatingSingle === t.id ? '...' : 'generar'}
                      </button>
                      <button
                        onClick={() => openDismissPrompt(t.id)}
                        disabled={dismissing === t.id}
                        className="text-xs text-gray-400 hover:text-red-500 disabled:opacity-50 cursor-pointer"
                        title="Descartar tema"
                      >
                        {dismissing === t.id ? '...' : 'descartar'}
                      </button>
                    </>
                  )}
                  {!isResearching && (
                    <button
                      onClick={() => toggleExpand(t.id)}
                      className="text-[10px] text-gray-400 hover:text-gray-600 w-5 h-5 flex items-center justify-center cursor-pointer"
                      title={isExpanded ? 'Colapsar' : 'Expandir'}
                    >
                      {isExpanded ? '\u25B2' : '\u25BC'}
                    </button>
                  )}
                </div>
              </div>

              {/* Expanded content */}
              {isResearching && (
                <div className="px-3 pb-3 space-y-2">
                  <div className="h-3 bg-gray-200 rounded animate-pulse w-3/4" />
                  <div className="h-3 bg-gray-200 rounded animate-pulse w-1/2" />
                </div>
              )}

              {!isResearching && isExpanded && (
                <div className="px-3 pb-3 border-t border-gray-100 pt-2">
                  <p className="text-sm text-gray-600 mb-3">{t.summary}</p>

                  {t.suggestedAngles.length > 0 && (
                    <ul className="space-y-1 mb-3">
                      {t.suggestedAngles.map((angle, i) => (
                        <li key={i} className="text-sm text-blue-600">
                          {'\u2192'} {angle}
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    <span>{t.signalCount} senales</span>
                    {t.lastSignalAt && (
                      <span>ultima: {formatDate(t.lastSignalAt)}</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Dismiss reason modal */}
      {dismissPromptId && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-5 w-full max-w-md mx-4">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">Motivo del descarte</h3>
            <textarea
              value={dismissReason}
              onChange={(e) => setDismissReason(e.target.value)}
              rows={3}
              autoFocus
              placeholder="¿Por qué descartás este tema?"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-500 focus:ring-1 focus:ring-gray-500 outline-none resize-none"
            />
            <div className="flex justify-end gap-2 mt-3">
              <button
                onClick={() => setDismissPromptId(null)}
                className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleDismiss}
                disabled={!dismissReason.trim()}
                className="px-4 py-1.5 text-sm font-medium rounded-md bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 transition-colors cursor-pointer"
              >
                Descartar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
