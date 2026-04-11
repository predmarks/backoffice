'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { MarketSnapshot } from '@/db/types';
import { DiffTextAdded, DiffTextRemoved } from '@/app/_components/WordDiff';

interface Props {
  marketId: string;
  current: MarketSnapshot;
  suggestion: MarketSnapshot;
}

interface FieldDiff {
  key: string;
  label: string;
  current: string;
  suggested: string;
  isText: boolean;
}

const FIELD_LABELS: Record<string, string> = {
  title: 'Título',
  description: 'Descripción',
  resolutionCriteria: 'Criterios de resolución',
  resolutionSource: 'Fuente de resolución',
  contingencies: 'Contingencias',
  category: 'Categoría',
  tags: 'Tags',
  outcomes: 'Opciones',
  endTimestamp: 'Fecha de cierre',
  expectedResolutionDate: 'Fecha esperada de resolución',
  timingSafety: 'Timing safety',
};

const TEXT_FIELDS = new Set([
  'title', 'description', 'resolutionCriteria', 'resolutionSource', 'contingencies',
]);

function formatTimestamp(ts: number): string {
  const d = new Date(ts * 1000);
  const parts = new Intl.DateTimeFormat('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('day')}/${get('month')}/${get('year')} ${get('hour')}:${get('minute')}`;
}

function stringify(key: string, value: unknown): string {
  if (key === 'endTimestamp' && typeof value === 'number') return formatTimestamp(value);
  if (Array.isArray(value)) return value.join(', ');
  return String(value ?? '');
}

function computeDiffs(current: MarketSnapshot, suggestion: MarketSnapshot): FieldDiff[] {
  const diffs: FieldDiff[] = [];
  const fields = Object.keys(FIELD_LABELS) as (keyof MarketSnapshot)[];

  for (const key of fields) {
    const c = current[key];
    const s = suggestion[key];
    if (JSON.stringify(c) !== JSON.stringify(s)) {
      diffs.push({
        key,
        label: FIELD_LABELS[key],
        current: stringify(key, c),
        suggested: stringify(key, s),
        isText: TEXT_FIELDS.has(key),
      });
    }
  }

  return diffs;
}

export function PendingSuggestion({ marketId, current, suggestion }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<'accept' | 'discard' | null>(null);

  const diffs = computeDiffs(current, suggestion);

  if (diffs.length === 0) return null;

  async function handleAccept() {
    setLoading('accept');
    try {
      await fetch(`/api/markets/${marketId}/suggestion`, { method: 'POST' });
      router.refresh();
    } catch {
      setLoading(null);
    }
  }

  async function handleDiscard() {
    setLoading('discard');
    try {
      await fetch(`/api/markets/${marketId}/suggestion`, { method: 'DELETE' });
      router.refresh();
    } catch {
      setLoading(null);
    }
  }

  return (
    <details open className="mb-4 rounded-md border border-indigo-200 bg-indigo-50/30 group">
      <summary className="flex items-center justify-between px-4 py-3 cursor-pointer list-none">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400 group-open:rotate-90 transition-transform">&#9654;</span>
          <span className="text-xs font-medium text-indigo-700 uppercase tracking-wide">Sugerencia del pipeline</span>
          <span className="text-[10px] text-indigo-500">{diffs.length} cambio{diffs.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={handleDiscard}
            disabled={loading !== null}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50 cursor-pointer"
          >
            {loading === 'discard' ? 'Descartando...' : 'Descartar'}
          </button>
          <button
            onClick={handleAccept}
            disabled={loading !== null}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-indigo-300 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50 cursor-pointer"
          >
            {loading === 'accept' ? 'Aceptando...' : 'Aceptar'}
          </button>
        </div>
      </summary>

      <div className="px-4 pb-3 space-y-3">
        {diffs.map((d) => (
          <div key={d.key}>
            <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">{d.label}</span>
            <div className="mt-1 grid grid-cols-2 gap-2">
              <div className="rounded bg-white border border-gray-200 px-2 py-1.5">
                <span className="text-[10px] text-gray-400 block mb-0.5">Actual</span>
                {d.isText
                  ? <DiffTextRemoved a={d.current} b={d.suggested} />
                  : <span className="text-sm text-gray-700">{d.current}</span>
                }
              </div>
              <div className="rounded bg-white border border-indigo-100 px-2 py-1.5">
                <span className="text-[10px] text-indigo-400 block mb-0.5">Sugerido</span>
                {d.isText
                  ? <DiffTextAdded a={d.current} b={d.suggested} />
                  : <span className="text-sm text-gray-700">{d.suggested}</span>
                }
              </div>
            </div>
          </div>
        ))}
      </div>
    </details>
  );
}
