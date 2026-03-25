import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { topics } from '@/db/schema';
import { desc, inArray } from 'drizzle-orm';

export async function GET() {
  const allTopics = await db
    .select()
    .from(topics)
    .where(inArray(topics.status, ['researching', 'active', 'stale']))
    .orderBy(desc(topics.score));
  return NextResponse.json({ topics: allTopics });
}
