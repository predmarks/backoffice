import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { markets } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { logMarketEvent } from '@/lib/market-events';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const [market] = await db.select().from(markets).where(eq(markets.id, id));

  if (!market) {
    return NextResponse.json({ error: 'Market not found' }, { status: 404 });
  }

  if (!market.isArchived) {
    return NextResponse.json(
      { error: 'Market is not archived' },
      { status: 400 },
    );
  }

  const [updated] = await db
    .update(markets)
    .set({ isArchived: false })
    .where(eq(markets.id, id))
    .returning();

  await logMarketEvent(id, 'human_unarchived');

  return NextResponse.json(updated);
}
