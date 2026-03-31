import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { markets } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { fetchOnchainMarketData, fetchMarketResult } from '@/lib/onchain';
import { fetchOnchainMarkets } from '@/lib/indexer';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(req.url);
  const full = url.searchParams.get('full') === 'true';

  const [market] = await db
    .select({ id: markets.id, onchainId: markets.onchainId, chainId: markets.chainId, outcomes: markets.outcomes })
    .from(markets)
    .where(eq(markets.id, id));

  if (!market?.onchainId) {
    return NextResponse.json({ error: 'Market not found or no onchainId' }, { status: 404 });
  }

  try {
    const data = await fetchOnchainMarketData(Number(market.onchainId), market.chainId);

    // Check indexer for resolvedTo
    let resolvedTo = 0;
    try {
      const indexerMarkets = await fetchOnchainMarkets(market.chainId, {
        where: { onchainId: market.onchainId },
      });
      const match = indexerMarkets.find((m) => m.onchainId === market.onchainId);
      if (match) resolvedTo = match.resolvedTo;
    } catch { /* indexer failure */ }

    // Fallback: check contract directly if indexer is behind
    if (resolvedTo === 0 && data.marketAddress && data.marketAddress !== '0x0000000000000000000000000000000000000000') {
      try {
        resolvedTo = await fetchMarketResult(data.marketAddress as `0x${string}`, market.chainId);
      } catch { /* contract read failed */ }
    }

    const now = Math.floor(Date.now() / 1000);
    const endTs = data.endTimestamp;
    const status = resolvedTo > 0 ? 'closed'
      : endTs && now > endTs ? 'in_resolution'
      : 'open';

    const outcomes = data.outcomes.length > 0 ? data.outcomes : (market.outcomes as string[]) ?? ['Si', 'No'];
    const resolvedOutcome = resolvedTo > 0 && resolvedTo <= outcomes.length ? outcomes[resolvedTo - 1] : undefined;

    // Status-only fields (always synced)
    const updates: Record<string, unknown> = {
      status,
      ...(resolvedOutcome ? { outcome: resolvedOutcome, resolvedAt: new Date() } : {}),
    };

    // Content fields (only synced on full refresh, e.g. after pushing a tx)
    if (full) {
      updates.title = data.name;
      if (data.description) updates.description = data.description;
      updates.category = data.category;
      if (data.outcomes.length > 0) updates.outcomes = data.outcomes;
      updates.endTimestamp = endTs;
      updates.expectedResolutionDate = new Date(endTs * 1000).toISOString().split('T')[0];
    }

    await db.update(markets).set(updates).where(eq(markets.id, id));

    return NextResponse.json({ ok: true, status, resolvedTo, full });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Refresh failed' },
      { status: 500 },
    );
  }
}
