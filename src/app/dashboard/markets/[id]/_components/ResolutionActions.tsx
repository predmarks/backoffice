'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function ResolutionConfirmButton({ marketId, outcome }: { marketId: string; outcome: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    setLoading(true);
    try {
      await fetch(`/api/markets/${marketId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outcome }),
      });
      router.refresh();
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleConfirm}
      disabled={loading}
      className="px-4 py-2 text-sm font-medium rounded-md bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 transition-colors cursor-pointer"
    >
      {loading ? 'Confirmando...' : `Confirmar: ${outcome}`}
    </button>
  );
}

export function ResolutionDiscardButton({ marketId }: { marketId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDiscard() {
    setLoading(true);
    try {
      await fetch(`/api/markets/${marketId}/dismiss-resolution`, { method: 'POST' });
      router.refresh();
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleDiscard}
      disabled={loading}
      className="px-4 py-2 text-sm font-medium rounded-md bg-gray-100 hover:bg-gray-200 text-gray-500 disabled:opacity-50 transition-colors cursor-pointer"
    >
      {loading ? '...' : 'Descartar'}
    </button>
  );
}

export function ResolutionFeedbackButton({ marketId }: { marketId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!feedback.trim()) return;
    setLoading(true);
    try {
      await fetch(`/api/markets/${marketId}/dismiss-resolution`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback }),
      });
      router.refresh();
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 text-sm font-medium rounded-md bg-gray-200 hover:bg-gray-300 text-gray-800 transition-colors cursor-pointer"
      >
        Reconsiderar
      </button>
    );
  }

  return (
    <div className="flex-1 space-y-2">
      <textarea
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        placeholder="¿Por qué debería reconsiderarse? (ej: la fuente no es confiable, el dato cambió...)"
        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-amber-400 focus:border-amber-400 resize-none"
        rows={2}
        autoFocus
      />
      <div className="flex items-center gap-2">
        <button
          onClick={handleSubmit}
          disabled={loading || !feedback.trim()}
          className="px-3 py-1.5 text-sm font-medium rounded-md bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-50 transition-colors cursor-pointer"
        >
          {loading ? 'Enviando...' : 'Enviar y re-evaluar'}
        </button>
        <button
          onClick={() => { setOpen(false); setFeedback(''); }}
          className="px-3 py-1.5 text-sm font-medium rounded-md bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors cursor-pointer"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
