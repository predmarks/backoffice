'use client';

import { useEffect, useState } from 'react';

interface FeedbackEntry {
  id: string;
  type: 'global' | 'rejection' | 'market_feedback' | 'topic_feedback' | 'topic_dismissed';
  text: string;
  contextLabel?: string;
  contextUrl?: string;
  usedBy: string[];
  createdAt: string;
}

const TYPE_CONFIG: Record<FeedbackEntry['type'], { label: string; className: string }> = {
  global: { label: 'Global', className: 'bg-gray-100 text-gray-700' },
  rejection: { label: 'Descarte', className: 'bg-red-100 text-red-700' },
  market_feedback: { label: 'Mercado', className: 'bg-blue-100 text-blue-700' },
  topic_feedback: { label: 'Tema', className: 'bg-purple-100 text-purple-700' },
  topic_dismissed: { label: 'Tema descartado', className: 'bg-orange-100 text-orange-700' },
};

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(new Date(iso));
}

export default function FeedbackPage() {
  const [entries, setEntries] = useState<FeedbackEntry[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadFeed() {
    setFetching(true);
    try {
      const res = await fetch('/api/feedback/all');
      if (res.ok) {
        const data = await res.json();
        setEntries(data.entries);
      }
    } finally {
      setFetching(false);
    }
  }

  useEffect(() => { loadFeed(); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/global-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Error');
      }
      setText('');
      await loadFeed();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    const realId = id.replace('global-', '');
    await fetch(`/api/global-feedback/${realId}`, { method: 'DELETE' });
    await loadFeed();
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-2">Feedback</h1>
      <p className="text-sm text-gray-500 mb-6">
        Todo el feedback dado a los agentes, unificado en una sola vista.
      </p>

      {/* Add global instruction */}
      <form onSubmit={handleSubmit} className="mb-8 flex gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder='Ej: "Nunca crear mercados sobre amistosos internacionales", "Siempre agregar contingencia del BCRA en mercados económicos"'
          maxLength={2000}
          rows={3}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm resize-none focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
        />
        <button
          type="submit"
          disabled={loading || !text.trim()}
          className="cursor-pointer self-end px-4 py-2 text-sm font-medium rounded-md bg-gray-900 hover:bg-gray-800 text-white disabled:opacity-50 transition-colors"
        >
          {loading ? '...' : 'Agregar'}
        </button>
      </form>
      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {/* Feed */}
      {fetching && entries.length === 0 ? (
        <div className="text-center py-12 text-gray-500">Cargando...</div>
      ) : entries.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No hay feedback todavía.
        </div>
      ) : (
        <div className="divide-y divide-gray-200">
          {entries.map((entry) => {
            const config = TYPE_CONFIG[entry.type];
            return (
              <div key={entry.id} className="py-3 flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${config.className}`}>
                      {config.label}
                    </span>
                    {entry.contextLabel && entry.contextUrl && (
                      <a
                        href={entry.contextUrl}
                        className="text-xs text-blue-600 hover:underline truncate max-w-xs"
                      >
                        {entry.contextLabel}
                      </a>
                    )}
                  </div>
                  <p className="text-sm text-gray-700">{entry.text}</p>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-gray-400">
                      {formatDate(entry.createdAt)}
                    </span>
                    <span className="text-xs text-gray-400">
                      Usado por: {entry.usedBy.join(', ')}
                    </span>
                  </div>
                </div>
                {entry.type === 'global' && (
                  <button
                    onClick={() => handleDelete(entry.id)}
                    className="cursor-pointer text-xs text-gray-400 hover:text-red-600 shrink-0"
                  >
                    Eliminar
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
