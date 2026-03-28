import { NextResponse } from 'next/server';
import { inngest } from '@/inngest/client';

export async function POST() {
  try {
    await inngest.send({
      name: 'signals/ingest.requested',
      data: {},
    });

    return NextResponse.json({ triggered: true });
  } catch (err) {
    console.error('[sourcing POST] inngest.send failed:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to trigger ingestion' },
      { status: 500 },
    );
  }
}
