import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { topics, topicConversations } from '@/db/schema';
import { desc, inArray, eq, sql } from 'drizzle-orm';

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
      conversationCount: sql<number>`(SELECT count(*)::int FROM topic_conversations WHERE topic_id = ${topics.id})`,
    })
    .from(topics)
    .where(inArray(topics.status, ['researching', 'active', 'stale']))
    .orderBy(desc(topics.score));
  return NextResponse.json({ topics: allTopics });
}
