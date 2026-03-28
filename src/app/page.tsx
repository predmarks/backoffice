export const dynamic = 'force-dynamic';

import { db } from '@/db/client';
import { markets } from '@/db/schema';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { MarketList } from './_components/MarketList';

export default async function HomePage() {
  const allMarkets = await db
    .select()
    .from(markets)
    .where(
      and(
        inArray(markets.status, ['open', 'in_resolution']),
        eq(markets.isArchived, false),
      ),
    )
    .orderBy(desc(markets.createdAt));

  const serialized = allMarkets.map((m) => ({
    id: m.id,
    title: m.title,
    category: m.category,
    status: m.status,
    endTimestamp: m.endTimestamp,
    onchainId: m.onchainId,
    volume: m.volume,
    participants: m.participants,
    resolution: m.resolution as { suggestedOutcome?: string; confidence?: string; flaggedAt?: string; evidenceUrls?: string[] } | null,
  }));

  return (
    <div className="max-w-5xl mx-auto py-10 px-4">
      <MarketList markets={serialized} />
    </div>
  );
}
