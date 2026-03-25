import { db } from '../src/db/client';
import { sql } from 'drizzle-orm';

async function migrate() {
  await db.execute(sql`ALTER TABLE topics ADD COLUMN IF NOT EXISTS feedback jsonb DEFAULT '[]'`);
  console.log('Done: added feedback column to topics table');
  process.exit(0);
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
