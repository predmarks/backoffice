import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { markets } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { logActivity } from '@/lib/activity-log';
import type { Resolution } from '@/db/types';

const ALLOWED_ACTIONS = [
  'market_updated_onchain',
  'market_resolved_onchain',
  'market_reported_onchain',
];

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json();
  const { action, detail } = body;

  if (!ALLOWED_ACTIONS.includes(action)) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  const [market] = await db
    .select({ id: markets.id, title: markets.title, resolution: markets.resolution })
    .from(markets)
    .where(eq(markets.id, id));

  if (!market) {
    return NextResponse.json({ error: 'Market not found' }, { status: 404 });
  }

  // Track reporter pending state in resolution object
  if (action === 'market_resolved_onchain' && detail?.reporterPending) {
    const resolution = (market.resolution as Record<string, unknown> | null) ?? {};
    await db.update(markets).set({
      resolution: { ...resolution, reporterPending: true } as unknown as Resolution,
    }).where(eq(markets.id, id));
  }

  if (action === 'market_reported_onchain') {
    const resolution = (market.resolution as Record<string, unknown> | null) ?? {};
    const { reporterPending: _, ...cleanResolution } = resolution;
    await db.update(markets).set({
      resolution: cleanResolution as unknown as Resolution,
    }).where(eq(markets.id, id));
  }

  await logActivity(action, {
    entityType: 'market',
    entityId: id,
    entityLabel: market.title,
    detail: detail ?? {},
    source: 'ui',
  });

  return NextResponse.json({ ok: true });
}
