'use client';

import { useEffect, useState } from 'react';

interface FeedbackEntry {
  id: string;
  text: string;
  createdAt: string;
}

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

export default function GlobalFeedbackPage() {
  const [entries, setEntries] = useState<FeedbackEntry[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch('/api/global-feedback');
    if (res.ok) setEntries(await res.json());
  }

  useEffect(() => { load(); }, []);

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
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/global-feedback/${id}`, { method: 'DELETE' });
    await load();
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-2">Feedback global</h1>
      <p className="text-sm text-gray-500 mb-6">
        Instrucciones que los agentes incorporan en todas las revisiones y generaciones futuras.
      </p>

      <form onSubmit={handleSubmit} className="mb-6 flex gap-2">
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
          className="self-end px-4 py-2 text-sm font-medium rounded-md bg-gray-900 hover:bg-gray-800 text-white disabled:opacity-50 transition-colors"
        >
          {loading ? '...' : 'Agregar'}
        </button>
      </form>
      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {entries.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No hay feedback global todavía.
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="bg-white rounded-lg border border-gray-200 px-4 py-3 flex items-start justify-between gap-3"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm text-gray-700">{entry.text}</p>
                <p className="text-xs text-gray-400 mt-1">{formatDate(entry.createdAt)}</p>
              </div>
              <button
                onClick={() => handleDelete(entry.id)}
                className="text-xs text-gray-400 hover:text-red-600 shrink-0"
              >
                Eliminar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
