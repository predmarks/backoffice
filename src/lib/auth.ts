import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { eq, and, gt } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { db } from '@/db/client';
import { users, sessions } from '@/db/schema';

export const SESSION_COOKIE_NAME = 'session_token';
export const SESSION_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000);

  await db.insert(sessions).values({ userId, token, expiresAt });

  return token;
}

export async function validateSession(
  token: string,
): Promise<{ userId: string; username: string } | null> {
  const rows = await db
    .select({ userId: users.id, username: users.username, expiresAt: sessions.expiresAt })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.token, token))
    .limit(1);

  if (rows.length === 0) return null;

  const row = rows[0];
  if (row.expiresAt < new Date()) {
    await db.delete(sessions).where(eq(sessions.token, token));
    return null;
  }

  return { userId: row.userId, username: row.username };
}

export async function deleteSession(token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.token, token));
}

export async function requireAuth(): Promise<{
  userId: string;
  username: string;
}> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    redirect('/login');
  }

  const session = await validateSession(token);
  if (!session) {
    cookieStore.delete(SESSION_COOKIE_NAME);
    redirect('/login');
  }

  return session;
}
