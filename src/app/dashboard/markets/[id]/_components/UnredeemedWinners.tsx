import type { UnredeemedPosition } from '@/lib/indexer';
import { getBasescanUrl } from '@/lib/chains';

function addr(a: string): string {
  return `${a.slice(0, 6)}...${a.slice(-4)}`;
}

function formatUsdc(raw: string): string {
  const n = Number(raw) / 1e6;
  if (n === 0) return '0';
  return n.toFixed(2);
}

interface Props {
  positions: UnredeemedPosition[];
  chainId: number;
}

export function UnredeemedWinners({ positions, chainId }: Props) {
  if (positions.length === 0) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 mb-4">
        <p className="text-xs text-green-700">Todas las posiciones ganadoras fueron redimidas</p>
      </div>
    );
  }

  const totalShares = positions.reduce((sum, p) => sum + Number(p.shares) / 1e6, 0);
  const basescanUrl = getBasescanUrl(chainId);

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 mb-4">
      <h4 className="text-sm font-semibold text-gray-700 mb-1">
        Posiciones ganadoras sin redimir
      </h4>
      <p className="text-xs text-gray-500 mb-3">
        {positions.length} usuario{positions.length !== 1 ? 's' : ''} con ${totalShares.toFixed(2)} en shares ganadoras sin redimir
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-gray-500 border-b border-amber-200">
              <th className="pb-1 font-medium">Cuenta</th>
              <th className="pb-1 font-medium text-right">Shares</th>
              <th className="pb-1 font-medium text-right">Invertido</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((p) => (
              <tr key={p.id} className="border-b border-amber-100 last:border-0">
                <td className="py-1">
                  <a
                    href={`${basescanUrl}/address/${p.account}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-blue-600 hover:underline"
                  >
                    {addr(p.account)}
                  </a>
                </td>
                <td className="py-1 text-right font-mono">${formatUsdc(p.shares)}</td>
                <td className="py-1 text-right font-mono">${formatUsdc(p.invested)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
