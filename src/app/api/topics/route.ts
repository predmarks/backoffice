import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { topics } from '@/db/schema';
import { desc, inArray, sql } from 'drizzle-orm';

export async function GET() {
  const allTopics = await db
    .select({
      id: topics.id,
      name: topics.name,
      slug: topics.slug,
      summary: topics.summary,
      category: topics.category,
      suggestedAngles: topics.suggestedAngles,
      score: topics.score,
      status: topics.status,
      signalCount: topics.signalCount,
      lastSignalAt: topics.lastSignalAt,
      lastGeneratedAt: topics.lastGeneratedAt,
      feedback: topics.feedback,
      createdAt: topics.createdAt,
      updatedAt: topics.updatedAt,
      marketCount: sql<number>`(SELECT count(*)::int FROM markets WHERE markets.source_context->'topicIds' @> to_jsonb("topics"."id") AND markets.status IN ('open', 'in_resolution'))`.mapWith(Number),
    })
    .from(topics)
    .where(inArray(topics.status, ['researching', 'active', 'stale']))
    .orderBy(desc(topics.score));
  return NextResponse.json({ topics: allTopics });
}
