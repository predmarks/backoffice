'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import type { MarketStatus, Review } from '@/db/types';

interface MarketActionsProps {
  marketId: string;
  status: MarketStatus;
  review: Review | null;
}

export function MarketActions({ marketId, status, review }: MarketActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const reviewing = status === 'review' && !review;

  useEffect(() => {
    if (reviewing) {
      pollRef.current = setInterval(() => router.refresh(), 5000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [reviewing, router]);

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

  const hasRewrites = review?.suggestedRewrites &&
    Object.values(review.suggestedRewrites).some(Boolean);

  return (
    <div className="space-y-3">
      <div className="flex gap-2 flex-wrap">
        {status === 'candidate' && (
          <ActionButton
            label="Iniciar Revisión"
            loading={loading === 'review'}
            onClick={() => handleAction(`/api/review/${marketId}`)}
            variant="primary"
          />
        )}

        {status === 'review' && !review && (
          <p className="text-sm text-yellow-700 bg-yellow-50 px-4 py-2 rounded-md">
            Revisión en progreso…
          </p>
        )}

        {status === 'review' && review && (
          <>
            <ActionButton
              label="Aprobar"
              loading={loading === 'approve'}
              onClick={() => handleAction('approve')}
              variant="success"
            />
            {hasRewrites && (
              <ActionButton
                label="Aprobar con Rewrites"
                loading={loading === 'approve-rw'}
                onClick={() =>
                  handleAction('approve', {
                    body: JSON.stringify({ applyRewrites: true }),
                  })
                }
                variant="success"
              />
            )}
            <ActionButton
              label="Rechazar"
              loading={loading === 'reject'}
              onClick={() =>
                handleAction('reject', {
                  body: JSON.stringify({ reason: 'Rejected by reviewer' }),
                })
              }
              variant="danger"
            />
          </>
        )}

        {(status === 'closed' || status === 'open') && (
          <>
            <ActionButton
              label="Resolver Sí"
              loading={loading === 'resolve-si'}
              onClick={() =>
                handleAction('resolve', {
                  body: JSON.stringify({ outcome: 'Si' }),
                })
              }
              variant="primary"
            />
            <ActionButton
              label="Resolver No"
              loading={loading === 'resolve-no'}
              onClick={() =>
                handleAction('resolve', {
                  body: JSON.stringify({ outcome: 'No' }),
                })
              }
              variant="secondary"
            />
          </>
        )}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
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
  variant: 'primary' | 'success' | 'danger' | 'secondary';
}) {
  const styles = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white',
    success: 'bg-green-600 hover:bg-green-700 text-white',
    danger: 'bg-red-600 hover:bg-red-700 text-white',
    secondary: 'bg-gray-200 hover:bg-gray-300 text-gray-800',
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
