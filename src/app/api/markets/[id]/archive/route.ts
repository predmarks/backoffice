import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { markets } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { logMarketEvent } from '@/lib/market-events';
import { ARCHIVABLE_STATUSES } from '@/db/types';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const [market] = await db.select().from(markets).where(eq(markets.id, id));

  if (!market) {
    return NextResponse.json({ error: 'Market not found' }, { status: 404 });
  }

  if (!(ARCHIVABLE_STATUSES as readonly string[]).includes(market.status)) {
    return NextResponse.json(
      { error: `Cannot archive a market with status "${market.status}"` },
      { status: 400 },
    );
  }

  const [updated] = await db
    .update(markets)
    .set({ isArchived: true })
    .where(eq(markets.id, id))
    .returning();

  await logMarketEvent(id, 'human_archived');

  return NextResponse.json(updated);
}
