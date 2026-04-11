import type { MarketSnapshot } from '@/db/types';

export function marketToSnapshot(market: {
  title: string;
  description: string;
  resolutionCriteria: string;
  resolutionSource: string;
  contingencies: string;
  category: string;
  tags: string[];
  outcomes: string[];
  endTimestamp: number;
  expectedResolutionDate: string | null;
  timingSafety: string;
}): MarketSnapshot {
  return {
    title: market.title,
    description: market.description,
    resolutionCriteria: market.resolutionCriteria,
    resolutionSource: market.resolutionSource,
    contingencies: market.contingencies,
    category: market.category as MarketSnapshot['category'],
    tags: market.tags,
    outcomes: market.outcomes,
    endTimestamp: market.endTimestamp,
    expectedResolutionDate: market.expectedResolutionDate ?? '',
    timingSafety: market.timingSafety as MarketSnapshot['timingSafety'],
  };
}
