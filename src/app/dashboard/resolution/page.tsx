export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { db } from '@/db/client';
import { markets } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import type { MarketStatus, TimingSafety, Resolution } from '@/db/types';
import { StatusBadge } from '../_components/StatusBadge';

function formatTimestamp(ts: number): string {
  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Argentina/Buenos_Aires',
  }).format(new Date(ts * 1000));
}

export default async function ResolutionPage() {
  const results = await db
    .select()
    .from(markets)
    .where(eq(markets.status, 'closed'))
    .orderBy(desc(markets.createdAt));

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Resolución</h1>

      {results.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No hay mercados cerrados pendientes de resolución.
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-200">
          {results.map((market) => {
            const resolution = market.resolution as Resolution | null;

            return (
              <Link
                key={market.id}
                href={`/dashboard/markets/${market.id}`}
                className="block px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900 truncate">
                      {market.title}
                    </p>
                    <div className="flex items-center gap-3 mt-1">
                      <StatusBadge status={market.status as MarketStatus} />
                      <span className="text-xs text-gray-500">
                        {market.category}
                      </span>
                      {resolution && (
                        <span className="text-xs text-gray-500">
                          Sugerido: {resolution.suggestedOutcome} ({resolution.confidence})
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right text-xs text-gray-500 shrink-0">
                    <div>Cerró: {formatTimestamp(market.endTimestamp)}</div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
