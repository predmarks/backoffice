import { NextRequest, NextResponse } from 'next/server';
import { inngest } from '@/inngest/client';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const topicIds = body.topicIds as string[] | undefined;
  const count = Math.min(Math.max(Number(body.count) || 10, 1), 50);

  await inngest.send({
    name: 'markets/generate.requested',
    data: { topicIds, count },
  });

  return NextResponse.json({ triggered: true });
}
