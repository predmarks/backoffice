'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function TopicActions({ topicId, status }: { topicId: string; status: string }) {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const [dismissing, setDismissing] = useState(false);

  async function handleGenerate() {
    setGenerating(true);
    try {
      await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicIds: [topicId], count: 1 }),
      });
      router.push('/dashboard');
    } catch { /* ignore */ } finally {
      setGenerating(false);
    }
  }

  async function handleDismiss() {
    setDismissing(true);
    try {
      await fetch(`/api/topics/${topicId}/dismiss`, { method: 'POST' });
      router.push('/dashboard');
    } catch { /* ignore */ } finally {
      setDismissing(false);
    }
  }

  return (
    <div className="flex items-center gap-2 shrink-0">
      {status === 'active' && (
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="px-3 py-1.5 text-xs font-medium rounded bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 transition-colors cursor-pointer"
        >
          {generating ? 'Generando...' : 'Generar mercado'}
        </button>
      )}
      {(status === 'active' || status === 'stale') && (
        <button
          onClick={handleDismiss}
          disabled={dismissing}
          className="px-3 py-1.5 text-xs font-medium rounded border border-gray-300 hover:bg-gray-50 text-gray-600 disabled:opacity-50 transition-colors cursor-pointer"
        >
          {dismissing ? '...' : 'Descartar'}
        </button>
      )}
    </div>
  );
}
