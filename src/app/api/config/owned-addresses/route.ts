import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { config } from '@/db/schema';
import { eq } from 'drizzle-orm';

const KEY = 'owned_addresses';

export async function GET() {
  const [row] = await db.select().from(config).where(eq(config.key, KEY));
  const addresses: string[] = row?.value ? JSON.parse(row.value) : [];
  return NextResponse.json({ addresses });
}

export async function PUT(req: Request) {
  const body = await req.json();
  const raw: unknown[] = body.addresses;

  if (!Array.isArray(raw)) {
    return NextResponse.json({ error: 'addresses must be an array' }, { status: 400 });
  }

  // Normalize: lowercase, deduplicate, validate format
  const seen = new Set<string>();
  const addresses: string[] = [];
  for (const addr of raw) {
    if (typeof addr !== 'string') continue;
    const normalized = addr.toLowerCase().trim();
    if (/^0x[a-f0-9]{40}$/.test(normalized) && !seen.has(normalized)) {
      seen.add(normalized);
      addresses.push(normalized);
    }
  }

  const value = JSON.stringify(addresses);
  await db
    .insert(config)
    .values({ key: KEY, value })
    .onConflictDoUpdate({ target: config.key, set: { value, updatedAt: new Date() } });

  return NextResponse.json({ addresses });
}
