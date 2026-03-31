import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { markets } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { fetchOnchainMarkets } from '@/lib/indexer';
import { validateChainId } from '@/lib/chains';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const chainId = validateChainId(Number(request.nextUrl.searchParams.get('chain')) || undefined);

  const [market] = await db
    .select({ title: markets.title })
    .from(markets)
    .where(eq(markets.id, id));

  if (!market) {
    return NextResponse.json({ error: 'Market not found' }, { status: 404 });
  }

  try {
    const onchainMarkets = await fetchOnchainMarkets(chainId);
    const match = onchainMarkets.find((m) => m.name === market.title);

    if (!match) {
      return NextResponse.json({ error: 'No onchain match found' }, { status: 404 });
    }

    return NextResponse.json({
      onchainId: match.onchainId,
      onchainAddress: match.id,
    });
  } catch {
    return NextResponse.json({ error: 'Indexer query failed' }, { status: 500 });
  }
}
