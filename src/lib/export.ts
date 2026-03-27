import type { Market, DeployableMarket } from '@/db/types';

export function toDeployableMarket(market: Market): DeployableMarket {
  const descriptionParts = [
    market.resolutionCriteria,
    market.contingencies,
    `Fuente de resolución: ${market.resolutionSource}`,
  ].filter(Boolean);

  const fullDescription = market.description
    ? `${market.description} ${descriptionParts.join(' ')}`
    : descriptionParts.join(' ');

  return {
    name: market.title,
    description: fullDescription,
    category: market.category,
    outcomes: market.outcomes,
    endTimestamp: market.endTimestamp,
  };
}
