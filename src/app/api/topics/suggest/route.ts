import { NextRequest, NextResponse } from 'next/server';
import { inngest } from '@/inngest/client';
import { db } from '@/db/client';
import { topics } from '@/db/schema';
import { slugify } from '@/agents/sourcer/types';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const description = body.description as string;

  if (!description?.trim()) {
    return NextResponse.json({ error: 'description is required' }, { status: 400 });
  }

  const trimmed = description.trim();
  const slug = slugify(trimmed.slice(0, 50));

  // Create placeholder topic immediately so it appears in the UI
  const [topic] = await db
    .insert(topics)
    .values({
      name: trimmed.slice(0, 80),
      slug,
      summary: '',
      category: 'Política',
      status: 'researching',
      signalCount: 0,
      score: 0,
    })
    .onConflictDoUpdate({
      target: topics.slug,
      set: { status: 'researching', updatedAt: new Date() },
    })
    .returning({ id: topics.id });

  await inngest.send({
    name: 'topics/suggest.requested',
    data: { description: trimmed, topicId: topic.id },
  });

  return NextResponse.json({ triggered: true, topicId: topic.id });
}
