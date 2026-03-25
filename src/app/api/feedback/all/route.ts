import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { globalFeedback, marketEvents, markets, topics } from '@/db/schema';
import { eq, desc, isNotNull } from 'drizzle-orm';

interface FeedbackEntry {
  id: string;
  type: 'global' | 'rejection' | 'market_feedback' | 'topic_feedback' | 'topic_dismissed';
  text: string;
  contextLabel?: string;
  contextUrl?: string;
  usedBy: string[];
  createdAt: string;
}

export async function GET() {
  const entries: FeedbackEntry[] = [];

  // 1. Global feedback
  const globalEntries = await db.select().from(globalFeedback).orderBy(desc(globalFeedback.createdAt)).limit(100);
  for (const e of globalEntries) {
    entries.push({
      id: `global-${e.id}`,
      type: 'global',
      text: e.text,
      usedBy: ['generador', 'revisor', 'extractor'],
      createdAt: e.createdAt.toISOString(),
    });
  }

  // 2. Market rejections with reasons
  const rejections = await db
    .select({ id: marketEvents.id, detail: marketEvents.detail, createdAt: marketEvents.createdAt, marketTitle: markets.title, marketId: markets.id })
    .from(marketEvents)
    .innerJoin(markets, eq(marketEvents.marketId, markets.id))
    .where(eq(marketEvents.type, 'human_rejected'))
    .orderBy(desc(marketEvents.createdAt))
    .limit(100);

  for (const e of rejections) {
    const detail = e.detail as Record<string, unknown> | null;
    const reason = detail?.reason as string | undefined;
    if (!reason) continue; // skip rejections without reasons
    entries.push({
      id: `rejection-${e.id}`,
      type: 'rejection',
      text: reason,
      contextLabel: e.marketTitle,
      contextUrl: `/dashboard/markets/${e.marketId}`,
      usedBy: ['generador'],
      createdAt: e.createdAt.toISOString(),
    });
  }

  // 3. Market feedback (from chat)
  const marketFeedback = await db
    .select({ id: marketEvents.id, detail: marketEvents.detail, createdAt: marketEvents.createdAt, marketTitle: markets.title, marketId: markets.id })
    .from(marketEvents)
    .innerJoin(markets, eq(marketEvents.marketId, markets.id))
    .where(eq(marketEvents.type, 'human_feedback'))
    .orderBy(desc(marketEvents.createdAt))
    .limit(100);

  for (const e of marketFeedback) {
    const detail = e.detail as Record<string, unknown> | null;
    const text = detail?.text as string | undefined;
    if (!text) continue;
    entries.push({
      id: `market-fb-${e.id}`,
      type: 'market_feedback',
      text,
      contextLabel: e.marketTitle,
      contextUrl: `/dashboard/markets/${e.marketId}`,
      usedBy: ['revisor'],
      createdAt: e.createdAt.toISOString(),
    });
  }

  // 4. Topic feedback + dismissed topics with feedback
  const topicsWithFeedback = await db
    .select()
    .from(topics)
    .where(isNotNull(topics.feedback))
    .orderBy(desc(topics.updatedAt))
    .limit(100);

  for (const t of topicsWithFeedback) {
    const feedbackArr = (t.feedback ?? []) as { text: string; createdAt: string }[];
    if (feedbackArr.length === 0) continue;

    const entryType = t.status === 'dismissed' ? 'topic_dismissed' : 'topic_feedback';
    for (const f of feedbackArr) {
      entries.push({
        id: `topic-${t.id}-${f.createdAt}`,
        type: entryType,
        text: f.text,
        contextLabel: t.name,
        contextUrl: `/dashboard/topics/${t.slug}`,
        usedBy: ['extractor', 'generador'],
        createdAt: f.createdAt,
      });
    }
  }

  // Sort all by date descending
  entries.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return NextResponse.json({ entries: entries.slice(0, 200) });
}
