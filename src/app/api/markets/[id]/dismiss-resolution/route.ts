import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { markets, resolutionFeedback } from '@/db/schema';
import { eq } from 'drizzle-orm';
import type { Resolution } from '@/db/types';
import { logActivity } from '@/lib/activity-log';
import { inngest } from '@/inngest/client';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const feedback: string | undefined = body.feedback;

  const [market] = await db.select().from(markets).where(eq(markets.id, id));

  if (!market) {
    return NextResponse.json({ error: 'Market not found' }, { status: 404 });
  }

  const dismissed = market.resolution as Resolution | null;

  // Save feedback for future resolution evaluations
  if (feedback?.trim()) {
    await db.insert(resolutionFeedback).values({
      text: feedback.trim(),
      marketId: id,
    });
  }

  // Clear current resolution
  await db
    .update(markets)
    .set({ resolution: null })
    .where(eq(markets.id, id));

  await logActivity('resolution_dismissed', {
    entityType: 'market',
    entityId: id,
    entityLabel: market.title,
    detail: {
      suggestedOutcome: dismissed?.suggestedOutcome,
      confidence: dismissed?.confidence,
      feedback: feedback?.trim() || null,
    },
    source: 'ui',
  });

  // Re-trigger resolution check only if feedback was provided (reconsider flow)
  if (feedback?.trim()) {
    await inngest.send({ name: 'markets/resolution.check', data: { id } });
  }

  return NextResponse.json({ dismissed: true });
}
