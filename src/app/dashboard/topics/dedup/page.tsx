'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface TopicInfo {
  id: string;
  name: string;
  slug: string;
  status: string;
  score: number;
  summary: string;
  suggestedAngles: string[];
  signalCount: number;
  category: string;
}

interface DedupPair {
  a: TopicInfo;
  b: TopicInfo;
  similarity: number;
}

interface Signal {
  id: string;
  type: string;
  text: string;
  summary?: string;
  url?: string;
  source: string;
  publishedAt?: string;
}

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  regular: 'bg-blue-100 text-blue-700',
  stale: 'bg-yellow-100 text-yellow-700',
};

function TopicSide({
  topic,
  signals,
  onLoadSignals,
  onMerge,
  merging,
}: {
  topic: TopicInfo;
  signals: Signal[] | null;
  onLoadSignals: () => void;
  onMerge: () => void;
  merging: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="flex-1 min-w-0 p-4 space-y-2">
      {/* Header */}
      <div className="flex items-start gap-2">
        <Link href={`/dashboard/topics/${topic.slug}`} className="text-sm font-medium text-blue-600 hover:underline flex-1">
          {topic.name}
        </Link>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[topic.status] ?? 'bg-gray-100 text-gray-600'}`}>
          {topic.status}
        </span>
      </div>

      {/* Meta */}
      <div className="flex gap-3 text-[10px] text-gray-400">
        <span>Score: {topic.score.toFixed(1)}</span>
        <span>{topic.category}</span>
        <span>{topic.signalCount} signals</span>
      </div>

      {/* Summary */}
      <p className="text-xs text-gray-600 leading-relaxed">{topic.summary}</p>

      {/* Angles */}
      {topic.suggestedAngles.length > 0 && (
        <div className="space-y-0.5">
          <span className="text-[10px] text-gray-400">Angles:</span>
          {topic.suggestedAngles.map((a, i) => (
            <p key={i} className="text-[11px] text-gray-500 pl-2">- {a}</p>
          ))}
        </div>
      )}

      {/* Signals (expandable) */}
      <div>
        <button
          onClick={() => {
            if (!expanded && !signals) onLoadSignals();
            setExpanded(!expanded);
          }}
          className="text-[10px] text-blue-600 hover:underline cursor-pointer"
        >
          {expanded ? '▼' : '▶'} {topic.signalCount} señales
        </button>
        {expanded && (
          <div className="mt-1 space-y-1 max-h-48 overflow-y-auto">
            {signals === null ? (
              <p className="text-[10px] text-gray-400">Cargando...</p>
            ) : signals.length === 0 ? (
              <p className="text-[10px] text-gray-400">Sin señales</p>
            ) : (
              signals.map((s) => (
                <div key={s.id} className="text-[11px] text-gray-600 py-0.5">
                  <span className="text-gray-400">[{s.source}]</span>{' '}
                  {s.url ? (
                    <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      {s.text.slice(0, 120)}
                    </a>
                  ) : (
                    s.text.slice(0, 120)
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Merge button */}
      <button
        onClick={onMerge}
        disabled={merging}
        className="w-full mt-2 px-3 py-1.5 text-xs font-medium rounded-lg border border-blue-300 text-blue-700 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
      >
        {merging ? 'Fusionando...' : '◀ Conservar este'}
      </button>
    </div>
  );
}

export default function DedupPage() {
  const [pairs, setPairs] = useState<DedupPair[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [merging, setMerging] = useState<string | null>(null);
  const [signalCache, setSignalCache] = useState<Record<string, Signal[]>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchProcessing, setBatchProcessing] = useState(false);

  const fetchPairs = useCallback(async () => {
    try {
      const res = await fetch('/api/topics/dedup');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setPairs(data.pairs ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchPairs(); }, [fetchPairs]);

  async function loadSignals(topicId: string) {
    if (signalCache[topicId]) return;
    try {
      const res = await fetch(`/api/topics/${topicId}`);
      if (res.ok) {
        const data = await res.json();
        setSignalCache((prev) => ({ ...prev, [topicId]: data.signals ?? [] }));
      }
    } catch { /* ignore */ }
  }

  async function handleMerge(targetId: string, sourceId: string, pairKey: string) {
    setMerging(pairKey);
    try {
      const res = await fetch(`/api/topics/${targetId}/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceTopicId: sourceId }),
      });
      if (res.ok) {
        setDismissed((prev) => new Set([...prev, pairKey]));
      }
    } catch { /* ignore */ }
    setMerging(null);
  }

  function handleDismiss(pairKey: string) {
    setDismissed((prev) => new Set([...prev, pairKey]));
  }

  function toggleSelect(pairKey: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(pairKey)) next.delete(pairKey);
      else next.add(pairKey);
      return next;
    });
  }

  const activePairs = pairs.filter((_, i) => !dismissed.has(String(i)));
  const activeKeys = activePairs.map((_, i) => String(pairs.indexOf(activePairs[i] as DedupPair)));
  const allSelected = activeKeys.length > 0 && activeKeys.every((k) => selected.has(k));

  function toggleSelectAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(activeKeys));
    }
  }

  async function batchDismiss() {
    setDismissed((prev) => new Set([...prev, ...selected]));
    setSelected(new Set());
  }

  async function batchAutoMerge() {
    setBatchProcessing(true);

    // Build merge pairs: keep topic with more signals (tie-break: higher score)
    const mergePairs: { targetId: string; sourceId: string }[] = [];
    const seenSourceIds = new Set<string>();

    for (const key of selected) {
      const idx = parseInt(key);
      const pair = pairs[idx];
      if (!pair || dismissed.has(key)) continue;

      const keepA = pair.a.signalCount > pair.b.signalCount ||
        (pair.a.signalCount === pair.b.signalCount && pair.a.score >= pair.b.score);
      const targetId = keepA ? pair.a.id : pair.b.id;
      const sourceId = keepA ? pair.b.id : pair.a.id;

      // Skip if source was already targeted in this batch
      if (seenSourceIds.has(sourceId)) continue;
      seenSourceIds.add(sourceId);

      mergePairs.push({ targetId, sourceId });
    }

    try {
      const res = await fetch('/api/topics/batch-merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pairs: mergePairs }),
      });

      if (res.ok) {
        const data = await res.json();
        const mergedSourceIds = new Set(
          (data.results as { sourceId: string; status: string }[])
            .filter((r) => r.status === 'merged')
            .map((r) => r.sourceId),
        );

        // Dismiss all pairs involving merged-away topics
        setDismissed((prev) => {
          const next = new Set(prev);
          pairs.forEach((p, i) => {
            if (mergedSourceIds.has(p.a.id) || mergedSourceIds.has(p.b.id)) next.add(String(i));
          });
          return next;
        });
      }
    } catch { /* ignore */ }

    setSelected(new Set());
    setBatchProcessing(false);
  }

  return (
    <div className="max-w-5xl">
      <div className="flex items-baseline justify-between mb-4">
        <h1 className="text-2xl font-bold">Temas duplicados</h1>
        <Link href="/dashboard/topics" className="text-sm text-blue-600 hover:underline">
          ← Volver a temas
        </Link>
      </div>

      {loading && <p className="text-sm text-gray-500">Calculando similitud...</p>}
      {error && <p className="text-sm text-red-500">{error}</p>}

      {/* Batch action bar */}
      {!loading && activePairs.length > 0 && (
        <div className="sticky top-0 z-10 bg-white border border-gray-200 rounded-lg p-3 flex items-center gap-3 shadow-sm">
          <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
            <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} className="rounded border-gray-300" />
            {allSelected ? 'Deseleccionar' : 'Seleccionar'} todos
          </label>
          {selected.size > 0 && (
            <>
              <span className="text-xs text-gray-400">{selected.size} seleccionados</span>
              <button
                onClick={batchDismiss}
                disabled={batchProcessing}
                className="text-xs px-3 py-1 rounded-full border border-gray-300 text-gray-600 hover:bg-gray-50 cursor-pointer disabled:opacity-50"
              >
                Descartar {selected.size}
              </button>
              <button
                onClick={batchAutoMerge}
                disabled={batchProcessing}
                className="text-xs px-3 py-1 rounded-full border border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-100 cursor-pointer disabled:opacity-50"
              >
                {batchProcessing ? 'Fusionando...' : `Auto-merge ${selected.size} (mayor señales)`}
              </button>
            </>
          )}
        </div>
      )}

      {!loading && activePairs.length === 0 && (
        <p className="text-sm text-gray-500">No hay duplicados pendientes de revisión.</p>
      )}

      <div className="space-y-4">
        {pairs.map((pair, i) => {
          if (dismissed.has(String(i))) return null;
          const pairKey = String(i);

          return (
            <div key={pairKey} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selected.has(pairKey)}
                    onChange={() => toggleSelect(pairKey)}
                    className="rounded border-gray-300"
                  />
                  <span className="text-xs font-mono text-gray-500">
                    {Math.round(pair.similarity * 100)}% similar
                  </span>
                </div>
                <button
                  onClick={() => handleDismiss(pairKey)}
                  className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  No son duplicados
                </button>
              </div>

              {/* Side by side */}
              <div className="flex divide-x divide-gray-100">
                <TopicSide
                  topic={pair.a}
                  signals={signalCache[pair.a.id] ?? null}
                  onLoadSignals={() => loadSignals(pair.a.id)}
                  onMerge={() => handleMerge(pair.a.id, pair.b.id, pairKey)}
                  merging={merging === pairKey}
                />
                <TopicSide
                  topic={pair.b}
                  signals={signalCache[pair.b.id] ?? null}
                  onLoadSignals={() => loadSignals(pair.b.id)}
                  onMerge={() => handleMerge(pair.b.id, pair.a.id, pairKey)}
                  merging={merging === pairKey}
                />
              </div>
            </div>
          );
        })}
      </div>

      {!loading && activePairs.length > 0 && (
        <p className="text-xs text-gray-400 mt-4 text-center">
          {activePairs.length} pares pendientes de {pairs.length} totales
        </p>
      )}
    </div>
  );
}
