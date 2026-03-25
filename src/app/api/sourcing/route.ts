import { NextResponse } from 'next/server';
import { inngest } from '@/inngest/client';

export async function POST() {
  await inngest.send({
    name: 'signals/ingest.requested',
    data: {},
  });

  return NextResponse.json({ triggered: true });
}
