'use client';

import dynamic from 'next/dynamic';

const MarketDiff = dynamic(
  () => import('./MarketDiff').then((m) => ({ default: m.MarketDiff })),
  { ssr: false },
);

interface OnchainData {
  name: string;
  description: string;
  category: string;
  outcomes: string[];
  endTimestamp: number;
}

interface Props {
  marketId: string;
  onchainId: number;
  title: string;
  description: string;
  category: string;
  outcomes: string[];
  endTimestamp: number;
  onchainData: OnchainData | null;
}

export function OnchainActionsWrapper(props: Props) {
  return <MarketDiff {...props} />;
}
