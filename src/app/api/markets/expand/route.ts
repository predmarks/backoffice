import { NextRequest, NextResponse } from 'next/server';
import { expandMarket } from '@/lib/expand-market';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { partial } = body as { partial: Record<string, unknown> };

  if (!partial || typeof partial !== 'object') {
    return NextResponse.json({ error: 'Se requiere el campo "partial" (objeto)' }, { status: 400 });
  }

  try {
    const generated = await expandMarket(partial);
    // Merge: user-provided fields take precedence
    const merged = { ...generated, ...partial };
    return NextResponse.json(merged);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error al completar campos' },
      { status: 500 },
    );
  }
}
