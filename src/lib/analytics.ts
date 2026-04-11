import { db } from '@/db/client';
import { markets } from '@/db/schema';
import { and, eq, isNotNull, isNull } from 'drizzle-orm';
import { createPublicClient, http, decodeFunctionData } from 'viem';
import { base, baseSepolia } from 'viem/chains';
import { PRECOG_MASTER_ABI } from './contracts';
import { MAINNET_CHAIN_ID } from './chains';
import { getOwnedAddresses } from './owned-addresses';
import { fetchOwnedPositionsDetailed, fetchMarketTxHashes, type OwnedPositionDetail } from './indexer';
import { fetchMarketPrices } from './onchain';

// --- Types ---

export interface MarketPnL {
  marketId: string;
  title: string;
  category: string;
  status: string;
  date: Date | null;
  seeded: number;         // USDC (divided by 1e6)
  pending: number;
  ownedInvested: number;
  ownedValue: number;
  ownedPnL: number;
  liquidityPnL: number;   // pending - seeded
  netPnL: number;         // liquidityPnL + ownedPnL
  cumulativePnL: number;  // running total (set after sort)
}

export interface PnLSummary {
  totalSeeded: number;
  totalPending: number;
  totalOwnedPnL: number;
  totalLiquidityPnL: number;
  netPnL: number;
  marketCount: number;
}

export interface AnalyticsData {
  summary: PnLSummary;
  markets: MarketPnL[];
}

// --- Helpers ---

const USDC_DECIMALS = 1e6;

function toUsdc(raw: string | null | undefined): number {
  if (!raw) return 0;
  return Number(BigInt(raw)) / USDC_DECIMALS;
}

function getClient(chainId: number) {
  const envKey = chainId === MAINNET_CHAIN_ID ? 'PREDMARKS_RPC_URL' : 'PREDMARKS_RPC_URL_SEPOLIA';
  const rpcUrl = process.env[envKey];
  if (!rpcUrl) throw new Error(`${envKey} is not set`);
  const chain = chainId === MAINNET_CHAIN_ID ? base : baseSepolia;
  return createPublicClient({ chain, transport: http(rpcUrl) });
}

// --- Fetch and cache seeded amounts from createCustomMarket calldata ---

export async function fetchAndCacheSeededAmounts(chainId: number): Promise<Map<string, bigint>> {
  // Find markets missing seededAmount
  const missing = await db
    .select({ id: markets.id, onchainAddress: markets.onchainAddress })
    .from(markets)
    .where(
      and(
        eq(markets.chainId, chainId),
        isNotNull(markets.onchainAddress),
        isNull(markets.seededAmount),
      ),
    );

  if (missing.length === 0) {
    // All cached — return from DB
    const all = await db
      .select({ onchainAddress: markets.onchainAddress, seededAmount: markets.seededAmount })
      .from(markets)
      .where(and(eq(markets.chainId, chainId), isNotNull(markets.onchainAddress)));

    const result = new Map<string, bigint>();
    for (const m of all) {
      if (m.onchainAddress && m.seededAmount) {
        result.set(m.onchainAddress.toLowerCase(), BigInt(m.seededAmount));
      }
    }
    return result;
  }

  // Fetch creation tx hashes from subgraph, then decode funding from calldata
  const client = getClient(chainId);
  const missingAddresses = missing
    .map((m) => m.onchainAddress)
    .filter((a): a is string => !!a);

  const txHashMap = await fetchMarketTxHashes(chainId, missingAddresses);

  const fundingMap = new Map<string, bigint>();

  for (const [marketAddr, txHash] of txHashMap) {
    try {
      const tx = await client.getTransaction({ hash: txHash as `0x${string}` });
      const decoded = decodeFunctionData({
        abi: PRECOG_MASTER_ABI,
        data: tx.input,
      });

      if (decoded.functionName === 'createCustomMarket') {
        const args = decoded.args as readonly [string, string, string, string[], bigint, bigint, string, bigint, bigint, string, string, string];
        const funding = args[7]; // funding is the 8th param (0-indexed: 7)
        fundingMap.set(marketAddr, funding);
      }
    } catch {
      // Skip if we can't decode (e.g., different function signature)
    }
  }

  // Cache in DB
  for (const m of missing) {
    if (!m.onchainAddress) continue;
    const funding = fundingMap.get(m.onchainAddress.toLowerCase());
    if (funding !== undefined) {
      await db
        .update(markets)
        .set({ seededAmount: funding.toString() })
        .where(eq(markets.id, m.id));
    }
  }

  // Return full map (cached + newly fetched)
  const all = await db
    .select({ onchainAddress: markets.onchainAddress, seededAmount: markets.seededAmount })
    .from(markets)
    .where(and(eq(markets.chainId, chainId), isNotNull(markets.onchainAddress)));

  const result = new Map<string, bigint>();
  for (const m of all) {
    if (m.onchainAddress && m.seededAmount) {
      result.set(m.onchainAddress.toLowerCase(), BigInt(m.seededAmount));
    }
  }
  return result;
}

// --- Compute owned positions PnL ---

interface PositionsByMarket {
  invested: bigint;
  value: bigint;
}

async function computeOwnedPositionsPnL(
  positions: OwnedPositionDetail[],
  dbMarkets: { onchainId: string | null; onchainAddress: string | null; outcomes: unknown; status: string }[],
  chainId: number,
): Promise<Map<string, PositionsByMarket>> {
  const result = new Map<string, PositionsByMarket>();

  // Group positions by market address
  const byMarket = new Map<string, OwnedPositionDetail[]>();
  for (const p of positions) {
    const key = p.marketAddress;
    const existing = byMarket.get(key) ?? [];
    existing.push(p);
    byMarket.set(key, existing);
  }

  // For open markets, fetch prices to mark-to-market
  const openMarketIds = new Set<string>();
  for (const m of dbMarkets) {
    if ((m.status === 'open' || m.status === 'in_resolution') && m.onchainId) {
      openMarketIds.add(m.onchainId);
    }
  }

  const priceCache = new Map<string, number[]>();
  for (const m of dbMarkets) {
    if (!m.onchainId || !openMarketIds.has(m.onchainId)) continue;
    const outcomeCount = (m.outcomes as string[])?.length ?? 2;
    try {
      const prices = await fetchMarketPrices(Number(m.onchainId), outcomeCount, chainId);
      priceCache.set(m.onchainId, prices);
    } catch {
      // Skip if prices unavailable
    }
  }

  for (const [marketAddr, marketPositions] of byMarket) {
    let totalInvested = BigInt(0);
    let totalValue = BigInt(0);

    for (const p of marketPositions) {
      totalInvested += BigInt(p.invested);

      if (p.resolvedTo > 0) {
        // Resolved market: winner gets shares back at 1:1
        if (p.outcome === p.resolvedTo) {
          totalValue += BigInt(p.shares);
        }
        // Losers get 0
      } else {
        // Open market: mark-to-market using current prices
        const prices = priceCache.get(p.onchainId);
        if (prices && prices[p.outcome - 1] !== undefined) {
          const price = prices[p.outcome - 1]; // percentage 0-100
          totalValue += (BigInt(p.shares) * BigInt(price)) / BigInt(100);
        } else {
          // No price data — use invested as conservative estimate
          totalValue += BigInt(p.invested);
        }
      }
    }

    result.set(marketAddr, { invested: totalInvested, value: totalValue });
  }

  return result;
}

// --- Main analytics function ---

export async function getAnalyticsData(chainId: number): Promise<AnalyticsData> {
  // Parallel fetch
  const [dbMarketRows, seededMap, ownedAddresses] = await Promise.all([
    db
      .select({
        id: markets.id,
        title: markets.title,
        category: markets.category,
        status: markets.status,
        publishedAt: markets.publishedAt,
        createdAt: markets.createdAt,
        onchainId: markets.onchainId,
        onchainAddress: markets.onchainAddress,
        pendingBalance: markets.pendingBalance,
        seededAmount: markets.seededAmount,
        outcomes: markets.outcomes,
      })
      .from(markets)
      .where(
        and(
          eq(markets.chainId, chainId),
          isNotNull(markets.onchainAddress),
        ),
      ),
    fetchAndCacheSeededAmounts(chainId),
    getOwnedAddresses(),
  ]);

  // Fetch owned positions from subgraph
  const ownedPositions = await fetchOwnedPositionsDetailed(chainId, ownedAddresses);

  // Compute owned positions PnL
  const ownedPnLMap = await computeOwnedPositionsPnL(ownedPositions, dbMarketRows, chainId);

  // Build per-market PnL
  const marketPnLs: MarketPnL[] = dbMarketRows.map((m) => {
    const addr = m.onchainAddress?.toLowerCase() ?? '';
    const seeded = toUsdc(seededMap.get(addr)?.toString());
    const pending = toUsdc(m.pendingBalance);
    const owned = ownedPnLMap.get(addr);
    const ownedInvested = owned ? Number(owned.invested) / USDC_DECIMALS : 0;
    const ownedValue = owned ? Number(owned.value) / USDC_DECIMALS : 0;
    const ownedPnL = ownedValue - ownedInvested;
    const liquidityPnL = pending - seeded;
    const netPnL = liquidityPnL + ownedPnL;

    return {
      marketId: m.id,
      title: m.title,
      category: m.category,
      status: m.status,
      date: m.publishedAt ?? m.createdAt,
      seeded,
      pending,
      ownedInvested,
      ownedValue,
      ownedPnL,
      liquidityPnL,
      netPnL,
      cumulativePnL: 0,
    };
  });

  // Sort by date and compute cumulative
  marketPnLs.sort((a, b) => {
    const da = a.date?.getTime() ?? 0;
    const db_ = b.date?.getTime() ?? 0;
    return da - db_;
  });

  let cumulative = 0;
  for (const m of marketPnLs) {
    cumulative += m.netPnL;
    m.cumulativePnL = cumulative;
  }

  // Summary
  const summary: PnLSummary = {
    totalSeeded: marketPnLs.reduce((s, m) => s + m.seeded, 0),
    totalPending: marketPnLs.reduce((s, m) => s + m.pending, 0),
    totalOwnedPnL: marketPnLs.reduce((s, m) => s + m.ownedPnL, 0),
    totalLiquidityPnL: marketPnLs.reduce((s, m) => s + m.liquidityPnL, 0),
    netPnL: cumulative,
    marketCount: marketPnLs.length,
  };

  return { summary, markets: marketPnLs };
}
