import { cookies } from 'next/headers';

const FALLBACK_TZ = 'America/Argentina/Buenos_Aires';

export async function getUserTimezone(): Promise<string> {
  const tz = (await cookies()).get('tz')?.value;
  return tz || FALLBACK_TZ;
}
