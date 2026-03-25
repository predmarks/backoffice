import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { signals } from '@/db/schema';
import { desc } from 'drizzle-orm';

export async function GET() {
  const allSignals = await db
    .select({
      id: signals.id,
      type: signals.type,
      text: signals.text,
      summary: signals.summary,
      url: signals.url,
      source: signals.source,
      category: signals.category,
      publishedAt: signals.publishedAt,
      score: signals.score,
      scoreReason: signals.scoreReason,
      dataPoints: signals.dataPoints,
    })
    .from(signals)
    .orderBy(desc(signals.publishedAt))
    .limit(500);

  return NextResponse.json({ signals: allSignals });
}
