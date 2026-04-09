'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import type { MarketStatus, Review, Iteration } from '@/db/types';
import { ARCHIVABLE_STATUSES } from '@/db/types';

interface MarketActionsProps {
  marketId: string;
  status: MarketStatus;
  review: Review | null;
  iterations?: Iteration[] | null;
  isArchived: boolean;
}

export function MarketActions({ marketId, status, iterations, isArchived }: MarketActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const processing = status === 'processing';

  useEffect(() => {
    if (processing) {
      pollRef.current = setInterval(() => router.refresh(), 5000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [processing, router]);

  async function handleAction(action: string, options?: RequestInit) {
    setLoading(action);
    setError(null);
    try {
      const res = await fetch(
        action.startsWith('/') ? action : `/api/markets/${marketId}/${action}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          ...options,
        },
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Action failed');
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(null);
    }
  }

  const iterationCount = iterations?.length ?? 0;

  return (
    <>
      <>
        {status === 'candidate' && (
          <ActionButton
            label="Iniciar Revisión"
            loading={loading === 'review'}
            onClick={() => handleAction(`/api/review/${marketId}`)}
            variant="indigo"
          />
        )}

        {status === 'processing' && (
          <>
            <p className="text-sm text-amber-700 bg-amber-50 px-4 py-2 rounded-md">
              Procesando… {iterationCount > 0 ? `(iteración ${iterationCount})` : ''}
            </p>
            <ActionButton
              label="Cancelar"
              loading={loading === 'cancel'}
              onClick={() => handleAction('cancel')}
              variant="amber"
            />
          </>
        )}

        {status === 'cancelled' && (
          <ActionButton
            label="Reanudar"
            loading={loading === 'resume'}
            onClick={() => handleAction('resume')}
            variant="violet"
          />
        )}

        {status === 'candidate' && (
          <ActionButton
            label="Rechazar"
            loading={loading === 'reject'}
            onClick={() =>
              handleAction('reject', {
                body: JSON.stringify({ reason: 'Rejected by reviewer' }),
              })
            }
            variant="rose"
          />
        )}

        {(ARCHIVABLE_STATUSES as readonly string[]).includes(status) && !isArchived && (
          <ActionButton
            label="Archivar"
            loading={loading === 'archive'}
            onClick={() => handleAction('archive')}
            variant="slate"
          />
        )}

        {isArchived && (
          <ActionButton
            label="Desarchivar"
            loading={loading === 'unarchive'}
            onClick={() => handleAction('unarchive')}
            variant="slate"
          />
        )}
      </>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </>
  );
}

function ActionButton({
  label,
  loading,
  onClick,
  variant,
}: {
  label: string;
  loading: boolean;
  onClick: () => void;
  variant: 'indigo' | 'violet' | 'rose' | 'amber' | 'slate';
}) {
  const styles = {
    indigo: 'border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100',
    violet: 'border border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100',
    rose: 'border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100',
    amber: 'border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100',
    slate: 'border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100',
  };

  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`px-4 py-2 text-sm font-medium rounded-md transition-colors disabled:opacity-50 ${styles[variant]}`}
    >
      {loading ? 'Procesando...' : label}
    </button>
  );
}
