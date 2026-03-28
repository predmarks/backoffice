import { inngest } from './client';
import { db } from '@/db/client';
import { markets, resolutionFeedback } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { evaluateResolution } from '@/agents/resolver/evaluator';
import { logActivity } from '@/lib/activity-log';
import type { Resolution } from '@/db/types';

export const resolutionJob = inngest.createFunction(
  { id: 'resolution-check', retries: 2, concurrency: { limit: 3 } },
  { event: 'markets/resolution.check' },
  async ({ event, step }) => {
    const marketId = event.data.id as string;

    const market = await step.run('load-market', async () => {
      const [m] = await db.select().from(markets).where(eq(markets.id, marketId));
      return m;
    });

    if (!market || !['open', 'in_resolution'].includes(market.status)) {
      return { status: 'skipped', reason: `status: ${market?.status ?? 'not found'}` };
    }

    const check = await step.run('evaluate', async () => {
      // Load market-specific feedback (graceful if table doesn't exist yet)
      let feedbackTexts: string[] = [];
      try {
        const marketFeedback = await db
          .select({ text: resolutionFeedback.text })
          .from(resolutionFeedback)
          .where(eq(resolutionFeedback.marketId, marketId))
          .orderBy(desc(resolutionFeedback.createdAt))
          .limit(10);
        feedbackTexts = marketFeedback.map((r) => r.text);
      } catch {
        console.warn('[resolution-job] Could not load resolution feedback, proceeding without it');
      }

      return evaluateResolution({
        title: market.title,
        description: market.description,
        outcomes: (market.outcomes as string[]) ?? ['Si', 'No'],
        resolutionCriteria: market.resolutionCriteria,
        resolutionSource: market.resolutionSource,
        endTimestamp: market.endTimestamp,
        feedback: feedbackTexts,
      });
    });

    if (check.status === 'unresolved') {
      return { status: 'unresolved', marketId };
    }

    // Save resolution data on the market
    await step.run('save-resolution', async () => {
      const existing = market.resolution as Resolution | null;
      const resolution: Resolution = {
        evidence: check.evidence,
        evidenceUrls: check.evidenceUrls,
        confidence: check.confidence,
        suggestedOutcome: check.suggestedOutcome ?? '',
        flaggedAt: existing?.flaggedAt ?? new Date().toISOString(),
      };

      await db
        .update(markets)
        .set({ resolution })
        .where(eq(markets.id, marketId));

      const action = check.isEmergency
        ? 'resolution_emergency'
        : check.status === 'resolved'
          ? 'resolution_flagged'
          : 'resolution_unclear';

      await logActivity(action, {
        entityType: 'market',
        entityId: marketId,
        entityLabel: market.title,
        detail: {
          status: check.status,
          suggestedOutcome: check.suggestedOutcome,
          confidence: check.confidence,
          isEmergency: check.isEmergency,
          emergencyReason: check.emergencyReason,
        },
        source: 'pipeline',
      });
    });

    return {
      status: check.status,
      marketId,
      suggestedOutcome: check.suggestedOutcome,
      confidence: check.confidence,
      isEmergency: check.isEmergency,
    };
  },
);
