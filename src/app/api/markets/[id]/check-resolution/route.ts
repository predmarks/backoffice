import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { markets } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { inngest } from '@/inngest/client';
import { logActivity } from '@/lib/activity-log';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const [market] = await db.select().from(markets).where(eq(markets.id, id));

  if (!market) {
    return NextResponse.json({ error: 'Market not found' }, { status: 404 });
  }

  const checkable = ['open', 'in_resolution'];
  if (!checkable.includes(market.status)) {
    return NextResponse.json(
      { error: `Cannot check resolution for status "${market.status}". Must be one of: ${checkable.join(', ')}.` },
      { status: 400 },
    );
  }

  try {
    await inngest.send({
      name: 'markets/resolution.check',
      data: { id },
    });
  } catch {
    // Inngest may not be available in all environments
  }

  await logActivity('resolution_check_started', {
    entityType: 'market',
    entityId: id,
    entityLabel: market.title,
    source: 'ui',
  });

  return NextResponse.json({ ok: true });
}
