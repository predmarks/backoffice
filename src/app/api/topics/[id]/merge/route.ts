import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { topics, topicSignals } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { logActivity } from '@/lib/activity-log';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: targetId } = await params;
  const { sourceTopicId } = await request.json();

  if (!sourceTopicId) {
    return NextResponse.json({ error: 'sourceTopicId required' }, { status: 400 });
  }

  // Load both topics
  const [target] = await db.select().from(topics).where(eq(topics.id, targetId));
  const [source] = await db.select().from(topics).where(eq(topics.id, sourceTopicId));

  if (!target || !source) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 });
  }

  // Skip if source is already dismissed (idempotent for batch operations)
  if (source.status === 'dismissed') {
    return NextResponse.json({ ok: true, targetId, signalCount: target.signalCount, skipped: true });
  }

  // Reassign signals from source → target (delete duplicates first to avoid conflicts)
  const sourceSignals = await db
    .select({ signalId: topicSignals.signalId })
    .from(topicSignals)
    .where(eq(topicSignals.topicId, sourceTopicId));

  for (const { signalId } of sourceSignals) {
    await db
      .insert(topicSignals)
      .values({ topicId: targetId, signalId })
      .onConflictDoNothing();
  }
  // Remove source's signal links
  await db
    .delete(topicSignals)
    .where(eq(topicSignals.topicId, sourceTopicId));

  // Recount target signals
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(topicSignals)
    .where(eq(topicSignals.topicId, targetId));

  // Update target with new signal count and latest signal timestamp
  const lastSignalAt = source.lastSignalAt && target.lastSignalAt
    ? (source.lastSignalAt > target.lastSignalAt ? source.lastSignalAt : target.lastSignalAt)
    : source.lastSignalAt ?? target.lastSignalAt;

  await db
    .update(topics)
    .set({
      signalCount: count,
      lastSignalAt,
      embedding: null, // clear cache — summary context changed
      updatedAt: new Date(),
    })
    .where(eq(topics.id, targetId));

  // Dismiss source topic
  await db
    .update(topics)
    .set({ status: 'dismissed', updatedAt: new Date() })
    .where(eq(topics.id, sourceTopicId));

  await logActivity('topics_merged', {
    entityType: 'topic',
    entityId: targetId,
    entityLabel: target.name,
    detail: {
      sourceTopicId,
      sourceTopicName: source.name,
      totalSignals: count,
    },
    source: 'ui',
  });

  return NextResponse.json({ ok: true, targetId, signalCount: count });
}
