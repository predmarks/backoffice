import { NextResponse } from 'next/server';
import { syncMarketStats } from '@/lib/sync-deployed';
import { validateChainId } from '@/lib/chains';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const chainId = validateChainId(body.chainId);
    const result = await syncMarketStats(chainId);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 },
    );
  }
}
