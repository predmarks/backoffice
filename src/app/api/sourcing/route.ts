import { NextRequest, NextResponse } from 'next/server';
import { inngest } from '@/inngest/client';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const count = Math.min(Math.max(Number(body.count) || 10, 1), 50);

  await inngest.send({
    name: 'market/sourcing.requested',
    data: { count },
  });

  return NextResponse.json({ triggered: true });
}
