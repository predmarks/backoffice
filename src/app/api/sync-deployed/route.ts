import { NextResponse } from 'next/server';
import { syncDeployedMarkets } from '@/lib/sync-deployed';

export async function POST() {
  try {
    const result = await syncDeployedMarkets();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 },
    );
  }
}
