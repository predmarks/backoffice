import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { topics } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { rescoreTopic } from '@/agents/sourcer/scorer';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { text } = await request.json();

  if (!text || typeof text !== 'string') {
    return NextResponse.json({ error: 'text is required' }, { status: 400 });
  }

  // Save the feedback
  const entry = JSON.stringify([{ text, createdAt: new Date().toISOString() }]);
  await db
    .update(topics)
    .set({
      feedback: sql`COALESCE(${topics.feedback}, '[]'::jsonb) || ${entry}::jsonb`,
      updatedAt: new Date(),
    })
    .where(eq(topics.id, id));

  // Re-score the topic with all feedback
  const [topic] = await db.select().from(topics).where(eq(topics.id, id)).limit(1);
  if (!topic) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const allFeedback = (topic.feedback ?? []) as { text: string; createdAt: string }[];
  const { score: newScore, reason } = await rescoreTopic(
    { name: topic.name, summary: topic.summary, category: topic.category },
    allFeedback,
  );

  // Update score + auto-stale if very low
  await db
    .update(topics)
    .set({
      score: newScore,
      ...(newScore < 2 ? { status: 'stale' } : {}),
      updatedAt: new Date(),
    })
    .where(eq(topics.id, id));

  return NextResponse.json({ ok: true, newScore, reason });
}
