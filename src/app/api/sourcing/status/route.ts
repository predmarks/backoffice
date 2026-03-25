import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { sourcingRuns } from '@/db/schema';
import { desc, eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  const runId = request.nextUrl.searchParams.get('runId');

  // Single run with signals
  if (runId) {
    const [run] = await db
      .select()
      .from(sourcingRuns)
      .where(eq(sourcingRuns.id, runId))
      .limit(1);

    if (!run) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ run });
  }

  // List view — exclude signals payload for performance
  const runs = await db
    .select({
      id: sourcingRuns.id,
      status: sourcingRuns.status,
      currentStep: sourcingRuns.currentStep,
      steps: sourcingRuns.steps,
      signalsCount: sourcingRuns.signalsCount,
      candidatesGenerated: sourcingRuns.candidatesGenerated,
      candidatesSaved: sourcingRuns.candidatesSaved,
      error: sourcingRuns.error,
      startedAt: sourcingRuns.startedAt,
      completedAt: sourcingRuns.completedAt,
    })
    .from(sourcingRuns)
    .orderBy(desc(sourcingRuns.startedAt))
    .limit(10);

  return NextResponse.json({ runs });
}
