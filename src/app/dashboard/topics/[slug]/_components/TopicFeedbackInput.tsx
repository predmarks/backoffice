'use client';

import { useState } from 'react';

interface FeedbackEntry {
  text: string;
  createdAt: string;
}

export function TopicFeedbackInput({
  topicId,
  initialFeedback,
  initialScore,
  onScoreChange,
}: {
  topicId: string;
  initialFeedback: FeedbackEntry[];
  initialScore: number;
  onScoreChange?: (newScore: number) => void;
}) {
  const [entries, setEntries] = useState<FeedbackEntry[]>(initialFeedback);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [score, setScore] = useState(initialScore);
  const [scoreUpdated, setScoreUpdated] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;

    setSending(true);
    setScoreUpdated(false);
    try {
      const res = await fetch(`/api/topics/${topicId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: trimmed }),
      });
      if (res.ok) {
        const data = await res.json();
        setEntries((prev) => [...prev, { text: trimmed, createdAt: new Date().toISOString() }]);
        setText('');
        if (data.newScore != null) {
          setScore(data.newScore);
          setScoreUpdated(true);
          onScoreChange?.(data.newScore);
          setTimeout(() => setScoreUpdated(false), 3000);
        }
      }
    } catch {
      // ignore
    } finally {
      setSending(false);
    }
  }

  const scoreColor = score >= 7 ? 'bg-green-100 text-green-700' :
    score >= 4 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700';

  return (
    <div>
      {/* Score indicator */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs text-gray-500">Score actual:</span>
        <span className={`px-2 py-0.5 rounded text-xs font-mono font-medium transition-all ${scoreColor} ${scoreUpdated ? 'ring-2 ring-blue-400 ring-offset-1' : ''}`}>
          {score.toFixed(1)}
        </span>
        {scoreUpdated && (
          <span className="text-xs text-blue-600 animate-pulse">recalculado</span>
        )}
      </div>

      {entries.length > 0 && (
        <ul className="space-y-2 mb-4">
          {entries.map((entry, i) => (
            <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
              <span className="text-gray-300 mt-0.5">&bull;</span>
              <div>
                <p>{entry.text}</p>
                <span className="text-[10px] text-gray-400">
                  {new Date(entry.createdAt).toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Agregar feedback..."
          className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={sending || !text.trim()}
          className="px-3 py-1.5 text-sm font-medium rounded bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 transition-colors cursor-pointer"
        >
          {sending ? 'Recalculando...' : 'Enviar'}
        </button>
      </form>
    </div>
  );
}
