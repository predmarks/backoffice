import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { markets } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const [market] = await db.select().from(markets).where(eq(markets.id, id));

  if (!market) {
    return NextResponse.json({ error: 'Market not found' }, { status: 404 });
  }

  return NextResponse.json(market);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json();

  const [existing] = await db.select().from(markets).where(eq(markets.id, id));
  if (!existing) {
    return NextResponse.json({ error: 'Market not found' }, { status: 404 });
  }

  const [updated] = await db
    .update(markets)
    .set(body)
    .where(eq(markets.id, id))
    .returning();

  return NextResponse.json(updated);
}
