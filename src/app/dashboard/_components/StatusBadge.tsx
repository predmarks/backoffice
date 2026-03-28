import type { MarketStatus } from '@/db/types';

const STATUS_STYLES: Record<MarketStatus, string> = {
  candidate: 'bg-blue-100 text-blue-800',
  processing: 'bg-amber-100 text-amber-800',
  open: 'bg-indigo-100 text-indigo-800',
  in_resolution: 'bg-yellow-100 text-yellow-800',
  closed: 'bg-purple-100 text-purple-800',
  rejected: 'bg-gray-100 text-gray-800',
  cancelled: 'bg-orange-100 text-orange-800',
};

const STATUS_LABELS: Record<MarketStatus, string> = {
  candidate: 'Candidato',
  processing: 'Procesando',
  open: 'Abierto',
  in_resolution: 'En resolución',
  closed: 'Resuelto',
  rejected: 'Rechazado',
  cancelled: 'Cancelado',
};

export function StatusBadge({ status }: { status: MarketStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
