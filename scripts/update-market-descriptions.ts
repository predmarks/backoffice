/**
 * One-time script to update all markets with real onchain descriptions.
 * Run: npx tsx scripts/update-market-descriptions.ts
 */
import { config } from 'dotenv';
config({ path: ['.env.local', '.env'] });

async function main() {
  const { db } = await import('../src/db/client');
  const { markets } = await import('../src/db/schema');
  const { isNotNull, eq } = await import('drizzle-orm');
  const { fetchOnchainMarketData } = await import('../src/lib/onchain');
  const { expandMarket } = await import('../src/lib/expand-market');

  // Get all markets with onchainId
  const allMarkets = await db
    .select({
      id: markets.id,
      onchainId: markets.onchainId,
      title: markets.title,
      category: markets.category,
      endTimestamp: markets.endTimestamp,
    })
    .from(markets)
    .where(isNotNull(markets.onchainId));

  console.log(`Found ${allMarkets.length} markets with onchainId`);

  let updated = 0;
  let failed = 0;

  for (const market of allMarkets) {
    try {
      const onchainData = await fetchOnchainMarketData(Number(market.onchainId));

      if (!onchainData.description) {
        console.log(`  [${market.onchainId}] No description onchain, skipping`);
        continue;
      }

      const updates: Record<string, unknown> = {
        description: onchainData.description,
      };

      if (onchainData.outcomes.length > 0) {
        updates.outcomes = onchainData.outcomes;
      }

      // Re-expand LLM fields with real description for better context
      try {
        const generated = await expandMarket({
          title: market.title,
          category: market.category,
          endTimestamp: market.endTimestamp,
          description: onchainData.description,
          outcomes: onchainData.outcomes,
        });

        if (generated.resolutionCriteria) updates.resolutionCriteria = generated.resolutionCriteria;
        if (generated.resolutionSource) updates.resolutionSource = generated.resolutionSource;
        if (generated.contingencies) updates.contingencies = generated.contingencies;
        if (generated.tags) updates.tags = generated.tags;
      } catch (err) {
        console.warn(`  [${market.onchainId}] LLM expand failed, using onchain data only:`, err);
      }

      await db.update(markets).set(updates).where(eq(markets.id, market.id));
      updated++;
      console.log(`  [${market.onchainId}] Updated: "${onchainData.description.slice(0, 80)}..."`);
    } catch (err) {
      failed++;
      console.error(`  [${market.onchainId}] Failed:`, err);
    }
  }

  console.log(`\nDone. Updated: ${updated}, Failed: ${failed}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
