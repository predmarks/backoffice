import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { markets } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { MARKET_STATUSES, MARKET_CATEGORIES } from '@/db/types';
import type { MarketStatus, MarketCategory } from '@/db/types';

export async function GET(request: NextRequest) {
  const status = request.nextUrl.searchParams.get('status');

  if (status && !MARKET_STATUSES.includes(status as MarketStatus)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  const query = db
    .select()
    .from(markets)
    .orderBy(desc(markets.createdAt));

  const results = status
    ? await query.where(eq(markets.status, status))
    : await query;

  return NextResponse.json(results);
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  const { title, description, resolutionCriteria, resolutionSource, category, endTimestamp } = body;

  if (!title || !description || !resolutionCriteria || !resolutionSource || !category || !endTimestamp) {
    return NextResponse.json(
      { error: 'Missing required fields: title, description, resolutionCriteria, resolutionSource, category, endTimestamp' },
      { status: 400 },
    );
  }

  if (!MARKET_CATEGORIES.includes(category as MarketCategory)) {
    return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
  }

  const [created] = await db
    .insert(markets)
    .values({
      title,
      description,
      resolutionCriteria,
      resolutionSource,
      contingencies: body.contingencies ?? '',
      category,
      tags: body.tags ?? [],
      outcomes: ['Si', 'No'],
      endTimestamp,
      expectedResolutionDate: body.expectedResolutionDate ?? null,
      timingSafety: body.timingSafety ?? 'safe',
      sourceContext: body.sourceContext ?? {
        originType: 'manual',
        generatedAt: new Date().toISOString(),
      },
    })
    .returning();

  return NextResponse.json(created, { status: 201 });
}
