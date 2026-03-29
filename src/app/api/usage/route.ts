import { NextResponse } from 'next/server';
import { getUsageData } from '@/lib/usage';

export async function GET() {
  const data = await getUsageData();
  return NextResponse.json(data);
}
