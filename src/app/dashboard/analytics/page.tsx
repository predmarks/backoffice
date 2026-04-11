export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { getAnalyticsData } from '@/lib/analytics';
import { validateChainId } from '@/lib/chains';
import { cn } from '@/lib/utils';
import PnLChart, { type PnLChartRow } from './_components/PnLChart';
import PnLTable from './_components/PnLTable';
import type { MarketPnL } from '@/lib/analytics';

/** Get the Monday (start of ISO week) for a given date */
function getWeekMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatWeekLabel(monday: Date): string {
  const dd = String(monday.getDate()).padStart(2, '0');
  const mm = String(monday.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}`;
}

function groupByWeek(markets: MarketPnL[]): PnLChartRow[] {
  const weekMap = new Map<string, { label: string; monday: Date | null; rows: MarketPnL[] }>();

  for (const m of markets) {
    const resolved = m.withdrawnAt;
    let key: string;
    let label: string;
    let monday: Date | null;

    if (resolved) {
      monday = getWeekMonday(resolved);
      key = monday.toISOString();
      label = formatWeekLabel(monday);
    } else {
      key = 'pending';
      label = 'Pendientes';
      monday = null;
    }

    const existing = weekMap.get(key);
    if (existing) {
      existing.rows.push(m);
    } else {
      weekMap.set(key, { label, monday, rows: [m] });
    }
  }

  // Sort: dated weeks chronologically, then pendientes at the end
  const entries = [...weekMap.values()].sort((a, b) => {
    if (!a.monday && !b.monday) return 0;
    if (!a.monday) return 1;
    if (!b.monday) return -1;
    return a.monday.getTime() - b.monday.getTime();
  });

  let cumulative = 0;
  return entries.map((entry) => {
    const seeded = entry.rows.reduce((s, m) => s + m.seeded, 0);
    const withdrawn = entry.rows.reduce((s, m) => s + m.withdrawn, 0);
    const pending = entry.rows.reduce((s, m) => s + m.pending, 0);
    const ownedPnL = entry.rows.reduce((s, m) => s + m.ownedPnL, 0);
    const liquidityPnL = entry.rows.reduce((s, m) => s + m.liquidityPnL, 0);
    const netPnL = entry.rows.reduce((s, m) => s + m.netPnL, 0);
    cumulative += netPnL;

    return {
      title: entry.label,
      seeded,
      withdrawn,
      pending,
      ownedPnL,
      liquidityPnL,
      netPnL,
      cumulativePnL: cumulative,
      status: '',
      marketCount: entry.rows.length,
    };
  });
}

interface Props {
  searchParams: Promise<{ chain?: string; showOpen?: string }>;
}

function formatUsd(value: number): string {
  const abs = Math.abs(value);
  const formatted = abs >= 1000
    ? `$${(abs / 1000).toFixed(1)}K`
    : `$${abs.toFixed(2)}`;
  return value < 0 ? `-${formatted}` : formatted;
}

function PnLValue({ value, className }: { value: number; className?: string }) {
  return (
    <span
      className={cn(
        'font-mono',
        value >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400',
        className,
      )}
    >
      {value >= 0 ? '+' : ''}{formatUsd(value)}
    </span>
  );
}

export default async function AnalyticsPage({ searchParams }: Props) {
  const params = await searchParams;
  const chainId = validateChainId(params.chain ? Number(params.chain) : undefined);
  const showOpen = params.showOpen === '1';

  let data;
  try {
    data = await getAnalyticsData(chainId);
  } catch (err) {
    console.error('[analytics] Failed to load analytics data:', err);
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">PnL</h1>
        <p className="text-sm text-muted-foreground/60">Error cargando datos de PnL.</p>
      </div>
    );
  }

  const allMarkets = data.markets;
  const filteredMarkets = showOpen
    ? allMarkets
    : allMarkets.filter((m) => m.status !== 'open' && m.status !== 'in_resolution');

  // Recompute cumulative PnL on filtered set
  let cumulative = 0;
  const markets = filteredMarkets.map((m) => {
    cumulative += m.netPnL;
    return { ...m, cumulativePnL: cumulative };
  });

  const summary = {
    totalSeeded: markets.reduce((s, m) => s + m.seeded, 0),
    totalWithdrawn: markets.reduce((s, m) => s + m.withdrawn, 0),
    totalPending: markets.reduce((s, m) => s + m.pending, 0),
    totalOwnedPnL: markets.reduce((s, m) => s + m.ownedPnL, 0),
    totalLiquidityPnL: markets.reduce((s, m) => s + m.liquidityPnL, 0),
    netPnL: cumulative,
    marketCount: markets.length,
  };

  // Build toggle link preserving existing params
  const toggleParams = new URLSearchParams();
  if (params.chain) toggleParams.set('chain', params.chain);
  if (!showOpen) toggleParams.set('showOpen', '1');
  const toggleHref = `/dashboard/analytics${toggleParams.size > 0 ? `?${toggleParams}` : ''}`;

  // Recovery ratio: (withdrawn + pending) / seeded
  const totalRecovered = summary.totalWithdrawn + summary.totalPending;
  const recoveryPct = summary.totalSeeded > 0
    ? ((totalRecovered / summary.totalSeeded) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">PnL</h1>
        <Link
          href={toggleHref}
          className={cn(
            'text-xs px-2.5 py-1 rounded-full border transition-colors',
            showOpen
              ? 'border-border text-muted-foreground hover:text-foreground'
              : 'border-primary/30 bg-primary/10 text-primary',
          )}
        >
          {showOpen ? 'Ocultar abiertos' : 'Sin abiertos'}
        </Link>
      </div>

      {/* Section 1: Global Summary */}
      <div className="bg-card rounded-lg border border-border p-5">
        <div className="flex flex-wrap gap-8 items-start mb-4">
          <Metric label="Total Fondeado" value={formatUsd(summary.totalSeeded)} />
          <Metric label="Total Retirado" value={formatUsd(summary.totalWithdrawn)} />
          <Metric label="Balance Pendiente" value={formatUsd(summary.totalPending)} />
          <Metric
            label="PnL LP"
            value={<PnLValue value={summary.totalLiquidityPnL} />}
          />
          <Metric
            label="PnL Trading"
            value={<PnLValue value={summary.totalOwnedPnL} />}
          />
          <Metric
            label="PnL Neto"
            value={<PnLValue value={summary.netPnL} className="text-lg font-bold" />}
          />
        </div>

        {/* Recovery bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground/60">
            <span>Recuperado (retirado + pendiente) vs fondeado</span>
            <span className="font-mono">{recoveryPct.toFixed(0)}%</span>
          </div>
          <div className="bg-muted rounded-full h-3 overflow-hidden">
            <div
              className={cn(
                'h-3 rounded-full transition-all',
                recoveryPct >= 80 ? 'bg-green-400 dark:bg-green-500' :
                recoveryPct >= 50 ? 'bg-amber-400 dark:bg-amber-500' :
                'bg-red-400 dark:bg-red-500',
              )}
              style={{ width: `${Math.min(recoveryPct, 100)}%` }}
            />
          </div>
        </div>

        <div className="mt-3 text-xs text-muted-foreground/60">
          {summary.marketCount} mercados desplegados
        </div>
      </div>

      {/* Section 2: Chart — grouped by resolution week */}
      <PnLChart data={groupByWeek(markets)} />

      {/* Section 3: Per-market breakdown */}
      <PnLTable
        markets={markets.map((m) => ({
          marketId: m.marketId,
          onchainId: m.onchainId,
          onchainAddress: m.onchainAddress,
          chainId,
          title: m.title,
          status: m.status,
          seeded: m.seeded,
          withdrawn: m.withdrawn,
          pending: m.pending,
          liquidityPnL: m.liquidityPnL,
          ownedPnL: m.ownedPnL,
          netPnL: m.netPnL,
        }))}
      />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground/60">{label}</div>
      <div className="text-lg font-mono">{value}</div>
    </div>
  );
}
