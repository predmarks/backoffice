import { inngest } from './client';
import { db } from '@/db/client';
import { markets } from '@/db/schema';
import { eq } from 'drizzle-orm';
import type { Review } from '@/db/types';
import { verifyData } from '@/agents/reviewer/data-verifier';
import { checkRules } from '@/agents/reviewer/rules-checker';
import { scoreMarket } from '@/agents/reviewer/scorer';
import { rewriteMarket } from '@/agents/reviewer/rewriter';

export const reviewJob = inngest.createFunction(
  { id: 'review-pipeline', retries: 2 },
  { event: 'market/candidate.created' },
  async ({ event, step }) => {
    const marketId = event.data.id as string;

    const market = await step.run('load-market', async () => {
      const [m] = await db
        .select()
        .from(markets)
        .where(eq(markets.id, marketId));
      if (!m) throw new Error(`Market ${marketId} not found`);
      return m;
    });

    const verification = await step.run('verify-data', async () => {
      return verifyData(market as Parameters<typeof verifyData>[0]);
    });

    const openMarketsList = await step.run('load-open-markets', async () => {
      return db
        .select({ id: markets.id, title: markets.title })
        .from(markets)
        .where(eq(markets.status, 'open'));
    });

    const rulesCheck = await step.run('check-rules', async () => {
      return checkRules(
        market as Parameters<typeof checkRules>[0],
        verification,
        openMarketsList,
      );
    });

    if (rulesCheck.rejected) {
      await step.run('reject-market', async () => {
        const review: Review = {
          scores: {
            ambiguity: 0,
            timingSafety: 0,
            timeliness: 0,
            volumePotential: 0,
            overallScore: 0,
          },
          hardRuleResults: rulesCheck.hardRuleResults,
          softRuleResults: rulesCheck.softRuleResults,
          dataVerification: verification.claims,
          resolutionSourceCheck: verification.resolutionSource,
          recommendation: 'reject',
          reviewedAt: new Date().toISOString(),
        };
        await db
          .update(markets)
          .set({ review, status: 'rejected' })
          .where(eq(markets.id, marketId));
      });
      return { status: 'rejected', marketId };
    }

    const scoring = await step.run('score-market', async () => {
      return scoreMarket(
        market as Parameters<typeof scoreMarket>[0],
        verification,
        rulesCheck,
      );
    });

    let rewrites: Review['suggestedRewrites'] = undefined;
    const needsRewrite =
      scoring.recommendation === 'rewrite_then_publish' ||
      scoring.scores.ambiguity < 7 ||
      scoring.scores.timingSafety < 7;

    if (needsRewrite) {
      rewrites = await step.run('rewrite-market', async () => {
        return rewriteMarket(
          market as Parameters<typeof rewriteMarket>[0],
          scoring,
          rulesCheck,
          verification,
        );
      });
    }

    await step.run('save-review', async () => {
      const review: Review = {
        scores: scoring.scores,
        hardRuleResults: rulesCheck.hardRuleResults,
        softRuleResults: rulesCheck.softRuleResults,
        dataVerification: verification.claims,
        resolutionSourceCheck: verification.resolutionSource,
        suggestedRewrites: rewrites,
        recommendation: scoring.recommendation,
        reviewedAt: new Date().toISOString(),
      };
      await db
        .update(markets)
        .set({ review, status: 'review' })
        .where(eq(markets.id, marketId));
    });

    return { status: 'reviewed', marketId };
  },
);
