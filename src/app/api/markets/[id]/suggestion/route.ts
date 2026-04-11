import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { markets } from '@/db/schema';
import { eq } from 'drizzle-orm';
import type { MarketSnapshot } from '@/db/types';
import { logMarketEvent } from '@/lib/market-events';
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

  const suggestion = market.pendingSuggestion as MarketSnapshot | null;
  if (!suggestion) {
    return NextResponse.json({ error: 'No pending suggestion' }, { status: 400 });
  }

  await db
    .update(markets)
    .set({
      title: suggestion.title,
      description: suggestion.description,
      resolutionCriteria: suggestion.resolutionCriteria,
      resolutionSource: suggestion.resolutionSource,
      contingencies: suggestion.contingencies,
      category: suggestion.category,
      tags: suggestion.tags,
      outcomes: suggestion.outcomes,
      endTimestamp: suggestion.endTimestamp,
      expectedResolutionDate: suggestion.expectedResolutionDate,
      timingSafety: suggestion.timingSafety,
      pendingSuggestion: null,
    })
    .where(eq(markets.id, id));

  await logMarketEvent(id, 'human_edited', {
    detail: { source: 'suggestion_accepted' },
  });
  await logActivity('suggestion_accepted', {
    entityType: 'market',
    entityId: id,
    entityLabel: market.title,
    source: 'ui',
  });

  return NextResponse.json({ accepted: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const [market] = await db.select().from(markets).where(eq(markets.id, id));

  if (!market) {
    return NextResponse.json({ error: 'Market not found' }, { status: 404 });
  }

  if (!market.pendingSuggestion) {
    return NextResponse.json({ error: 'No pending suggestion' }, { status: 400 });
  }

  await db
    .update(markets)
    .set({ pendingSuggestion: null })
    .where(eq(markets.id, id));

  await logActivity('suggestion_discarded', {
    entityType: 'market',
    entityId: id,
    entityLabel: market.title,
    source: 'ui',
  });

  return NextResponse.json({ discarded: true });
}
