import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { markets } from '@/db/schema';
import { eq } from 'drizzle-orm';
import type { Review } from '@/db/types';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const [market] = await db.select().from(markets).where(eq(markets.id, id));

  if (!market) {
    return NextResponse.json({ error: 'Market not found' }, { status: 404 });
  }

  if (market.status !== 'review') {
    return NextResponse.json(
      { error: `Cannot approve a market with status "${market.status}". Must be "review".` },
      { status: 400 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const applyRewrites = body.applyRewrites === true;

  const updates: Record<string, unknown> = {
    status: 'approved',
    publishedAt: new Date(),
  };

  // Apply suggested rewrites if requested
  const review = market.review as Review | null;
  if (applyRewrites && review?.suggestedRewrites) {
    const rw = review.suggestedRewrites;
    if (rw.title) updates.title = rw.title;
    if (rw.description) updates.description = rw.description;
    if (rw.resolutionCriteria) updates.resolutionCriteria = rw.resolutionCriteria;
    if (rw.contingencies) updates.contingencies = rw.contingencies;
  }

  const [updated] = await db
    .update(markets)
    .set(updates)
    .where(eq(markets.id, id))
    .returning();

  return NextResponse.json(updated);
}
