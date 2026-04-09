export const dynamic = 'force-dynamic';

import { db } from '@/db/client';
import { markets } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getOwnedAddresses } from '@/lib/owned-addresses';
import { validateChainId, getBasescanUrl } from '@/lib/chains';
import { fetchMarketsWithUnredeemedWinners } from '@/lib/indexer';
import { RedemptionsView } from './_components/RedemptionsView';
import type { LiquidityMarket } from './_components/RedemptionsView';
import type { WithdrawalProgress } from '@/db/types';

interface Props {
  searchParams: Promise<{ chain?: string }>;
}

export default async function RedemptionsPage({ searchParams }: Props) {
  const params = await searchParams;
  const chainId = validateChainId(params.chain ? Number(params.chain) : undefined);
  const basescanUrl = getBasescanUrl(chainId);

  // Load owned addresses from config
  const ownedAddresses = await getOwnedAddresses();

  // Fetch unredeemed winners from subgraph
  let summaries: Awaited<ReturnType<typeof fetchMarketsWithUnredeemedWinners>> = [];
  try {
    summaries = await fetchMarketsWithUnredeemedWinners(chainId);
  } catch {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">Liquidity</h1>
        <p className="text-sm text-red-500">Error al consultar el indexer. Intentá de nuevo.</p>
      </div>
    );
  }

  // Cross-reference with DB to get internal IDs, pending balances, and withdrawal status
  const closedMarkets = await db
    .select({
      id: markets.id,
      onchainId: markets.onchainId,
      onchainAddress: markets.onchainAddress,
      title: markets.title,
      outcomes: markets.outcomes,
      outcome: markets.outcome,
      pendingBalance: markets.pendingBalance,
      resolution: markets.resolution,
    })
    .from(markets)
    .where(
      and(
        eq(markets.status, 'closed'),
        eq(markets.chainId, chainId),
      ),
    );

  const dbByOnchainId = new Map(
    closedMarkets
      .filter((m) => m.onchainId)
      .map((m) => [m.onchainId!, m]),
  );

  const indexerByOnchainId = new Map(
    summaries.map((s) => [s.onchainId, s]),
  );

  // Build unified list: markets that have pending liquidity OR unredeemed positions (or both)
  const seenOnchainIds = new Set<string>();
  const unified: LiquidityMarket[] = [];

  // First pass: indexer markets that also have pending liquidity
  for (const s of summaries) {
    seenOnchainIds.add(s.onchainId);
    const dbMarket = dbByOnchainId.get(s.onchainId);
    if (!dbMarket?.pendingBalance || parseFloat(dbMarket.pendingBalance) <= 0) continue;
    const withdrawal = (dbMarket?.resolution as { withdrawal?: WithdrawalProgress } | null)?.withdrawal ?? null;
    if (withdrawal?.withdrawnAt) continue;

    unified.push({
      marketAddress: s.marketAddress,
      onchainId: s.onchainId,
      marketName: s.marketName,
      resolvedTo: s.resolvedTo,
      unredeemedCount: s.unredeemedCount,
      totalUnredeemedShares: s.totalUnredeemedShares.toString(),
      totalUnredeemedInvested: s.totalUnredeemedInvested.toString(),
      positions: s.positions,
      dbId: dbMarket?.id,
      dbTitle: dbMarket?.title,
      outcomes: (dbMarket?.outcomes as string[]) ?? [],
      pendingBalance: dbMarket?.pendingBalance ?? null,
      withdrawal,
    });
  }

  // Second pass: DB markets with pending liquidity that weren't in the indexer
  for (const m of closedMarkets) {
    if (!m.onchainId || seenOnchainIds.has(m.onchainId)) continue;
    if (!m.pendingBalance || parseFloat(m.pendingBalance) <= 0) continue;
    const withdrawal = (m.resolution as { withdrawal?: WithdrawalProgress } | null)?.withdrawal ?? null;
    if (withdrawal?.withdrawnAt) continue; // already withdrawn

    unified.push({
      marketAddress: m.onchainAddress ?? '',
      onchainId: m.onchainId,
      marketName: m.title,
      resolvedTo: 0,
      unredeemedCount: 0,
      totalUnredeemedShares: '0',
      totalUnredeemedInvested: '0',
      positions: [],
      dbId: m.id,
      dbTitle: m.title,
      outcomes: (m.outcomes as string[]) ?? [],
      pendingBalance: m.pendingBalance,
      withdrawal,
    });
  }

  // Sort: markets with both pending liquidity and unredeemed positions first, then by balance
  unified.sort((a, b) => {
    const aHasBoth = (a.pendingBalance && parseFloat(a.pendingBalance) > 0 ? 1 : 0) + (a.unredeemedCount > 0 ? 1 : 0);
    const bHasBoth = (b.pendingBalance && parseFloat(b.pendingBalance) > 0 ? 1 : 0) + (b.unredeemedCount > 0 ? 1 : 0);
    if (bHasBoth !== aHasBoth) return bHasBoth - aHasBoth;
    return (parseFloat(b.pendingBalance ?? '0')) - (parseFloat(a.pendingBalance ?? '0'));
  });

  return (
    <RedemptionsView
      markets={unified}
      ownedAddresses={ownedAddresses}
      basescanUrl={basescanUrl}
    />
  );
}
