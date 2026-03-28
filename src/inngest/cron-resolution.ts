import { inngest } from './client';
import { db } from '@/db/client';
import { markets } from '@/db/schema';
import { eq } from 'drizzle-orm';

export const cronResolution = inngest.createFunction(
  { id: 'cron-resolution-check' },
  { cron: '0 8 * * *' },
  async ({ step }) => {
    const now = Math.floor(Date.now() / 1000);
    const in72h = now + 72 * 60 * 60;

    const eligible = await step.run('find-eligible', async () => {
      // Open markets closing within 72h
      const openMarkets = await db
        .select({ id: markets.id, endTimestamp: markets.endTimestamp })
        .from(markets)
        .where(eq(markets.status, 'open'));

      const nearDeadline = openMarkets
        .filter((m) => m.endTimestamp <= in72h)
        .map((m) => m.id);

      // In-resolution markets without a resolution suggestion yet
      const inResolution = await db
        .select({ id: markets.id })
        .from(markets)
        .where(eq(markets.status, 'in_resolution'));

      const needsCheck = inResolution
        .map((m) => m.id);

      // Deduplicate
      return [...new Set([...nearDeadline, ...needsCheck])];
    });

    if (eligible.length > 0) {
      await step.sendEvent('dispatch-checks',
        eligible.map((id) => ({
          name: 'markets/resolution.check' as const,
          data: { id },
        })),
      );
    }

    return { dispatched: eligible.length };
  },
);
