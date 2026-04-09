'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export interface LiquidityMarket {
  marketAddress: string;
  onchainId: string;
  marketName: string;
  resolvedTo: number;
  unredeemedCount: number;
  totalUnredeemedShares: string;
  totalUnredeemedInvested: string;
  positions: { id: string; account: string; shares: string; invested: string; lastEventTimestamp: number }[];
  dbId?: string;
  dbTitle?: string;
  outcomes: string[];
  pendingBalance?: string | null;
  withdrawal: { ownershipTransferredAt?: string; withdrawnAt?: string } | null;
}

interface Props {
  markets: LiquidityMarket[];
  ownedAddresses: string[];
  basescanUrl: string;
}

function formatUsdc(raw: string): string {
  const n = Number(raw) / 1e6;
  if (n === 0) return '$0';
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function addr(a: string): string {
  return `${a.slice(0, 6)}...${a.slice(-4)}`;
}

// --- Modal ---

function OwnedAddressesModal({
  addresses,
  onClose,
}: {
  addresses: string[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [list, setList] = useState<string[]>(addresses);
  const [input, setInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleAdd() {
    const val = input.trim().toLowerCase();
    if (!/^0x[a-f0-9]{40}$/.test(val)) {
      setError('Dirección inválida (debe ser 0x + 40 hex chars)');
      return;
    }
    if (list.includes(val)) {
      setError('Dirección ya agregada');
      return;
    }
    setList([...list, val]);
    setInput('');
    setError(null);
  }

  function handleRemove(addr: string) {
    setList(list.filter((a) => a !== addr));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/config/owned-addresses', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addresses: list }),
      });
      if (!res.ok) throw new Error('Failed to save');
      router.refresh();
      onClose();
    } catch {
      setError('Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      {/* Modal */}
      <div className="relative bg-white rounded-lg border border-gray-200 shadow-lg w-full max-w-md mx-4 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-800">Direcciones propias</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 cursor-pointer text-lg leading-none">&times;</button>
        </div>

        <p className="text-xs text-gray-500 mb-3">
          Las posiciones de estas direcciones se muestran por separado y no cuentan como retiros pendientes.
        </p>

        {/* Address list */}
        {list.length > 0 ? (
          <div className="space-y-1 mb-3 max-h-48 overflow-y-auto">
            {list.map((a) => (
              <div key={a} className="flex items-center justify-between bg-gray-50 rounded px-2 py-1">
                <span className="text-xs font-mono text-gray-700">{a}</span>
                <button
                  onClick={() => handleRemove(a)}
                  className="text-red-400 hover:text-red-600 text-xs cursor-pointer ml-2"
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-400 mb-3">Sin direcciones configuradas.</p>
        )}

        {/* Add input */}
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={input}
            onChange={(e) => { setInput(e.target.value); setError(null); }}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="0x..."
            className="flex-1 px-2 py-1.5 text-xs font-mono border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-gray-400"
          />
          <button
            onClick={handleAdd}
            className="px-3 py-1.5 text-xs font-medium rounded bg-gray-100 hover:bg-gray-200 text-gray-700 cursor-pointer"
          >
            Agregar
          </button>
        </div>

        {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

        {/* Save */}
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-medium rounded border border-gray-300 text-gray-600 hover:bg-gray-50 cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-3 py-1.5 text-xs font-medium rounded bg-gray-900 text-white hover:bg-gray-800 disabled:opacity-50 cursor-pointer"
          >
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Positions table ---

function PositionsTable({
  positions,
  basescanUrl,
  muted,
}: {
  positions: LiquidityMarket['positions'];
  basescanUrl: string;
  muted?: boolean;
}) {
  if (positions.length === 0) return null;
  const textClass = muted ? 'text-gray-400' : 'text-gray-700';
  const linkClass = muted ? 'text-gray-400 hover:text-gray-600' : 'text-blue-600 hover:underline';

  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-left text-gray-400 border-b border-gray-100">
          <th className="px-4 py-1.5 font-medium">Cuenta</th>
          <th className="px-4 py-1.5 font-medium text-right">Shares</th>
          <th className="px-4 py-1.5 font-medium text-right">Invertido</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-50">
        {positions.map((p) => (
          <tr key={p.id} className="hover:bg-gray-50">
            <td className="px-4 py-1.5">
              <a
                href={`${basescanUrl}/address/${p.account}`}
                target="_blank"
                rel="noopener noreferrer"
                className={`font-mono ${linkClass}`}
              >
                {addr(p.account)}
              </a>
            </td>
            <td className={`px-4 py-1.5 text-right font-mono ${textClass}`}>
              {formatUsdc(p.shares)}
            </td>
            <td className={`px-4 py-1.5 text-right font-mono ${textClass}`}>
              {formatUsdc(p.invested)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// --- Main view ---

export function RedemptionsView({ markets, ownedAddresses, basescanUrl }: Props) {
  const [showModal, setShowModal] = useState(false);
  const ownedSet = useMemo(() => new Set(ownedAddresses.map((a) => a.toLowerCase())), [ownedAddresses]);

  // Split positions per market into external vs owned
  const filtered = useMemo(() => {
    return markets.map((m) => {
      const external = m.positions.filter((p) => !ownedSet.has(p.account.toLowerCase()));
      const owned = m.positions.filter((p) => ownedSet.has(p.account.toLowerCase()));
      return { ...m, external, owned };
    });
  }, [markets, ownedSet]);

  const hasAnyOwned = filtered.some((m) => m.owned.length > 0);
  const [showOwned, setShowOwned] = useState(false);

  return (
    <div>
      {/* Page header */}
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold">Liquidity</h1>
        <button
          onClick={() => setShowModal(true)}
          className="px-3 py-1.5 text-xs font-medium rounded border border-gray-300 text-gray-600 hover:bg-gray-50 cursor-pointer"
        >
          Direcciones propias{ownedAddresses.length > 0 ? ` (${ownedAddresses.length})` : ''}
        </button>
      </div>

      <p className="text-sm text-gray-500 mb-6">
        {filtered.length === 0
          ? 'No hay mercados con liquidez o retiros pendientes.'
          : `${filtered.length} mercado${filtered.length !== 1 ? 's' : ''} con liquidez o retiros pendientes.`}
      </p>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">Sin pendientes</div>
      ) : (
        <>
          <div className="space-y-4">
            {filtered.map((s) => {
              const resolvedOutcome = s.outcomes.length >= s.resolvedTo && s.resolvedTo > 0
                ? s.outcomes[s.resolvedTo - 1]
                : s.resolvedTo > 0 ? `#${s.resolvedTo}` : null;

              const hasPendingBalance = s.pendingBalance && parseFloat(s.pendingBalance) > 0;
              const withdrawalStatus = s.withdrawal?.withdrawnAt
                ? 'withdrawn'
                : s.withdrawal?.ownershipTransferredAt
                ? 'in_progress'
                : 'pending';

              return (
                <div key={s.onchainId || s.marketAddress} className="bg-white rounded-lg border border-gray-200">
                  <div className="px-4 py-3 border-b border-gray-100 flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      {s.dbId ? (
                        <Link href={`/dashboard/markets/${s.dbId}`} className="text-blue-600 hover:underline font-medium text-sm">
                          {s.dbTitle ?? s.marketName}
                        </Link>
                      ) : (
                        <span className="text-gray-700 font-medium text-sm">{s.marketName}</span>
                      )}
                      {s.marketAddress && (
                        <span className="block text-xs text-gray-400 font-mono mt-0.5">{addr(s.marketAddress)}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {resolvedOutcome && (
                        <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          {resolvedOutcome}
                        </span>
                      )}
                      {hasPendingBalance && (
                        <span className="text-xs text-gray-700 font-mono font-semibold">
                          {formatUsdc(s.pendingBalance!)}
                        </span>
                      )}
                      {hasPendingBalance && withdrawalStatus === 'in_progress' && (
                        <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                          Retiro en progreso
                        </span>
                      )}
                      {hasPendingBalance && withdrawalStatus === 'pending' && (
                        <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
                          Liquidez pendiente
                        </span>
                      )}
                      {s.external.length > 0 && (
                        <span className="text-xs text-amber-600 font-semibold">
                          {s.external.length} sin redimir
                        </span>
                      )}
                      {s.owned.length > 0 && (
                        <span className="text-xs text-gray-400">
                          +{s.owned.length} propias
                        </span>
                      )}
                    </div>
                  </div>
                  {s.external.length > 0 && (
                    <PositionsTable positions={s.external} basescanUrl={basescanUrl} />
                  )}
                </div>
              );
            })}
          </div>

          {/* Owned-only section */}
          {hasAnyOwned && (
            <div className="mt-6">
              <button
                onClick={() => setShowOwned(!showOwned)}
                className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                {showOwned ? '▼' : '▶'} Direcciones propias ({filtered.reduce((s, m) => s + m.owned.length, 0)} posiciones en {filtered.filter((m) => m.owned.length > 0).length} mercados)
              </button>

              {showOwned && (
                <div className="space-y-3 mt-3">
                  {filtered.filter((m) => m.owned.length > 0).map((s) => {
                    const resolvedOutcome = s.outcomes.length >= s.resolvedTo && s.resolvedTo > 0
                      ? s.outcomes[s.resolvedTo - 1]
                      : s.resolvedTo > 0 ? `#${s.resolvedTo}` : null;

                    return (
                      <div key={`owned-${s.onchainId || s.marketAddress}`} className="bg-gray-50 rounded-lg border border-gray-100">
                        <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between gap-4">
                          <span className="text-xs text-gray-500 truncate">
                            {s.dbTitle ?? s.marketName}
                          </span>
                          <span className="text-xs text-gray-400">
                            {resolvedOutcome ?? '—'} — {s.owned.length} posicion{s.owned.length !== 1 ? 'es' : ''}
                          </span>
                        </div>
                        <PositionsTable positions={s.owned} basescanUrl={basescanUrl} muted />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Modal */}
      {showModal && (
        <OwnedAddressesModal
          addresses={ownedAddresses}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
