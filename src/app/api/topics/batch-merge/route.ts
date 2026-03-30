import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { topics, topicSignals } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { logActivity } from '@/lib/activity-log';

interface MergePair {
  targetId: string;
  sourceId: string;
}

interface MergeResult {
  targetId: string;
  sourceId: string;
  status: 'merged' | 'skipped' | 'error';
  error?: string;
}

export async function POST(request: NextRequest) {
  const { pairs } = await request.json() as { pairs: MergePair[] };

  if (!pairs || !Array.isArray(pairs) || pairs.length === 0) {
    return NextResponse.json({ error: 'pairs array required' }, { status: 400 });
  }

  const results: MergeResult[] = [];
  const dismissed = new Set<string>(); // track topics dismissed during this batch

  for (const { targetId, sourceId } of pairs) {
    // Skip if source was already dismissed in this batch
    if (dismissed.has(sourceId)) {
      results.push({ targetId, sourceId, status: 'skipped' });
      continue;
    }

    try {
      const [target] = await db.select().from(topics).where(eq(topics.id, targetId));
      const [source] = await db.select().from(topics).where(eq(topics.id, sourceId));

      if (!target || !source) {
        results.push({ targetId, sourceId, status: 'skipped', error: 'not found' });
        continue;
      }

      if (source.status === 'dismissed') {
        results.push({ targetId, sourceId, status: 'skipped' });
        continue;
      }

      // Reassign signals from source → target
      const sourceSignals = await db
        .select({ signalId: topicSignals.signalId })
        .from(topicSignals)
        .where(eq(topicSignals.topicId, sourceId));

      for (const { signalId } of sourceSignals) {
        await db
          .insert(topicSignals)
          .values({ topicId: targetId, signalId })
          .onConflictDoNothing();
      }
      await db.delete(topicSignals).where(eq(topicSignals.topicId, sourceId));

      // Recount
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(topicSignals)
        .where(eq(topicSignals.topicId, targetId));

      const lastSignalAt = source.lastSignalAt && target.lastSignalAt
        ? (source.lastSignalAt > target.lastSignalAt ? source.lastSignalAt : target.lastSignalAt)
        : source.lastSignalAt ?? target.lastSignalAt;

      await db
        .update(topics)
        .set({ signalCount: count, lastSignalAt, embedding: null, updatedAt: new Date() })
        .where(eq(topics.id, targetId));

      await db
        .update(topics)
        .set({ status: 'dismissed', updatedAt: new Date() })
        .where(eq(topics.id, sourceId));

      dismissed.add(sourceId);

      await logActivity('topics_merged', {
        entityType: 'topic',
        entityId: targetId,
        entityLabel: target.name,
        detail: { sourceTopicId: sourceId, sourceTopicName: source.name, totalSignals: count },
        source: 'ui',
      });

      results.push({ targetId, sourceId, status: 'merged' });
    } catch (err) {
      results.push({ targetId, sourceId, status: 'error', error: err instanceof Error ? err.message : 'unknown' });
    }
  }

  const merged = results.filter((r) => r.status === 'merged').length;
  const skipped = results.filter((r) => r.status === 'skipped').length;

  return NextResponse.json({ ok: true, merged, skipped, total: pairs.length, results });
}
