import type { TimingSafety } from '@/db/types';

const TIMING_STYLES: Record<TimingSafety, { color: string; label: string }> = {
  safe: { color: 'text-green-600', label: 'Seguro' },
  caution: { color: 'text-yellow-600', label: 'Precaución' },
  dangerous: { color: 'text-red-600', label: 'Peligroso' },
};

export function TimingSafetyIndicator({ safety }: { safety: TimingSafety }) {
  const { color, label } = TIMING_STYLES[safety];
  return <span className={`text-xs font-medium ${color}`}>{label}</span>;
}
