import type { Market, DeployableMarket } from '@/db/types';

export function toDeployableMarket(market: Market): DeployableMarket {
  return {
    name: market.title,
    description: market.description,
    category: market.category,
    outcomes: market.outcomes.map((o) => o.replace(/,/g, '.')),
    endTimestamp: market.endTimestamp,
  };
}
