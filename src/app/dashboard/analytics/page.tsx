export const dynamic = 'force-dynamic';

import { getAnalyticsData, type MarketPnL } from '@/lib/analytics';
import { validateChainId } from '@/lib/chains';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import PnLChart from './_components/PnLChart';

interface Props {
  searchParams: Promise<{ chain?: string; sort?: string }>;
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

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-indigo-400 dark:bg-indigo-500',
  in_resolution: 'bg-amber-400 dark:bg-amber-500',
  closed: 'bg-green-400 dark:bg-green-500',
  rejected: 'bg-muted-foreground/50',
  cancelled: 'bg-muted-foreground/50',
};

export default async function AnalyticsPage({ searchParams }: Props) {
  const params = await searchParams;
  const chainId = validateChainId(params.chain ? Number(params.chain) : undefined);
  const sortBy = params.sort === 'pnl' ? 'pnl' : 'date';

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

  const { summary, markets } = data;

  // Sort markets for the table
  const sortedMarkets = [...markets];
  if (sortBy === 'pnl') {
    sortedMarkets.sort((a, b) => b.netPnL - a.netPnL);
  }
  // else already sorted by date from getAnalyticsData

  // Recovery ratio
  const recoveryPct = summary.totalSeeded > 0
    ? ((summary.totalPending / summary.totalSeeded) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">PnL</h1>

      {/* Section 1: Global Summary */}
      <div className="bg-card rounded-lg border border-border p-5">
        <div className="flex flex-wrap gap-8 items-start mb-4">
          <Metric label="Total Fondeado" value={formatUsd(summary.totalSeeded)} />
          <Metric label="Balance Pendiente" value={formatUsd(summary.totalPending)} />
          <Metric
            label="PnL Liquidez"
            value={<PnLValue value={summary.totalLiquidityPnL} />}
          />
          <Metric
            label="PnL Posiciones Propias"
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
            <span>Balance pendiente vs fondeado</span>
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

      {/* Section 2: Chart */}
      <PnLChart
        data={markets.map((m) => ({
          title: m.title,
          seeded: m.seeded,
          pending: m.pending,
          ownedPnL: m.ownedPnL,
          liquidityPnL: m.liquidityPnL,
          netPnL: m.netPnL,
          cumulativePnL: m.cumulativePnL,
          status: m.status,
        }))}
      />

      {/* Section 3: Per-market breakdown */}
      <div className="bg-card rounded-lg border border-border p-5">
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-sm font-medium text-muted-foreground">Desglose por mercado</h2>
          <div className="flex gap-2">
            <SortLink href={`/dashboard/analytics?sort=date${params.chain ? `&chain=${params.chain}` : ''}`} active={sortBy === 'date'} label="Por fecha" />
            <SortLink href={`/dashboard/analytics?sort=pnl${params.chain ? `&chain=${params.chain}` : ''}`} active={sortBy === 'pnl'} label="Por PnL" />
          </div>
        </div>

        {sortedMarkets.length === 0 ? (
          <p className="text-sm text-muted-foreground/60">Sin datos</p>
        ) : (
          <div className="space-y-1">
            {/* Header */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground/60 py-1 border-b border-border">
              <span className="w-3 shrink-0" />
              <span className="flex-1 min-w-0">Mercado</span>
              <span className="w-16 text-right shrink-0">Fondeado</span>
              <span className="w-16 text-right shrink-0">Pendiente</span>
              <span className="w-20 text-right shrink-0">PnL Liq.</span>
              <span className="w-20 text-right shrink-0">PnL Pos.</span>
              <span className="w-20 text-right shrink-0">PnL Neto</span>
            </div>

            {sortedMarkets.map((m) => (
              <MarketRow key={m.marketId} market={m} />
            ))}
          </div>
        )}
      </div>
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

function SortLink({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      className={cn(
        'text-xs px-2 py-0.5 rounded-full border',
        active
          ? 'bg-primary text-primary-foreground border-primary'
          : 'text-muted-foreground border-border hover:border-foreground/30',
      )}
    >
      {label}
    </Link>
  );
}

function MarketRow({ market: m }: { market: MarketPnL }) {
  const isUnrealized = m.status === 'open' || m.status === 'in_resolution';
  return (
    <div className="flex items-center gap-2 text-xs py-1.5">
      <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', STATUS_COLORS[m.status] ?? 'bg-muted-foreground/40')} />
      <span className="flex-1 min-w-0 truncate text-foreground" title={m.title}>
        {m.title}
        {isUnrealized && (
          <span className="ml-1.5 text-amber-500 dark:text-amber-400 text-[10px]">(no realizado)</span>
        )}
      </span>
      <span className="w-16 text-right font-mono text-muted-foreground shrink-0">
        {formatUsd(m.seeded)}
      </span>
      <span className="w-16 text-right font-mono text-muted-foreground shrink-0">
        {formatUsd(m.pending)}
      </span>
      <span className="w-20 text-right shrink-0">
        <PnLValue value={m.liquidityPnL} />
      </span>
      <span className="w-20 text-right shrink-0">
        {m.ownedPnL !== 0 ? <PnLValue value={m.ownedPnL} /> : <span className="text-muted-foreground/40 font-mono">—</span>}
      </span>
      <span className="w-20 text-right shrink-0">
        <PnLValue value={m.netPnL} className="font-medium" />
      </span>
    </div>
  );
}
