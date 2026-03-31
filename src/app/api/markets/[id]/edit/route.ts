import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { markets } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { logActivity } from '@/lib/activity-log';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const [market] = await db.select().from(markets).where(eq(markets.id, id));

  if (!market) {
    return NextResponse.json({ error: 'Market not found' }, { status: 404 });
  }

  const nonEditable = ['closed', 'rejected'];
  if (nonEditable.includes(market.status)) {
    return NextResponse.json(
      { error: `Cannot edit a market with status "${market.status}".` },
      { status: 400 },
    );
  }

  const body = await request.json();

  const allowedFields = [
    'title',
    'description',
    'resolutionCriteria',
    'resolutionSource',
    'contingencies',
    'category',
    'tags',
    'endTimestamp',
    'expectedResolutionDate',
    'timingSafety',
  ];

  const updates: Record<string, unknown> = {};
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of allowedFields) {
    if (body[key] !== undefined) {
      const oldVal = (market as Record<string, unknown>)[key];
      updates[key] = body[key];
      changes[key] = { from: oldVal, to: body[key] };
    }
  }

  const [updated] = await db
    .update(markets)
    .set(updates)
    .where(eq(markets.id, id))
    .returning();

  await logActivity('market_edited', {
    entityType: 'market',
    entityId: id,
    entityLabel: updated.title,
    detail: changes,
    source: 'ui',
  });

  return NextResponse.json(updated);
}
