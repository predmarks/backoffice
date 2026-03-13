import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { markets } from '@/db/schema';
import { eq } from 'drizzle-orm';

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
      { error: `Cannot edit a market with status "${market.status}". Must be "review".` },
      { status: 400 },
    );
  }

  const body = await request.json();
  const { approve, ...fields } = body;

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
  for (const key of allowedFields) {
    if (fields[key] !== undefined) {
      updates[key] = fields[key];
    }
  }

  if (approve) {
    updates.status = 'approved';
    updates.publishedAt = new Date();
  }

  const [updated] = await db
    .update(markets)
    .set(updates)
    .where(eq(markets.id, id))
    .returning();

  return NextResponse.json(updated);
}
