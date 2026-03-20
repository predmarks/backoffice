import { config } from 'dotenv';
config({ path: ['.env.local', '.env'] });
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import bcrypt from 'bcryptjs';
import * as schema from '../src/db/schema';

const sql = postgres(process.env.POSTGRES_URL!, { prepare: false });
const db = drizzle(sql, { schema });

async function seedUser() {
  const hash = await bcrypt.hash('wallofshame', 12);
  await db
    .insert(schema.users)
    .values({ username: 'predmarks', passwordHash: hash })
    .onConflictDoNothing();
  console.log('User seeded: predmarks');
  await sql.end();
  process.exit(0);
}

seedUser().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
