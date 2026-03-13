import { db } from '@/db/client';
import { markets } from '@/db/schema';
import { eq } from 'drizzle-orm';
import type { Review } from '@/db/types';
import { verifyData } from './data-verifier';
import { checkRules } from './rules-checker';
import { scoreMarket } from './scorer';
import { rewriteMarket } from './rewriter';

export async function runReview(marketId: string): Promise<Review> {
  // Load market
  const [market] = await db.select().from(markets).where(eq(markets.id, marketId));
  if (!market) throw new Error(`Market ${marketId} not found`);

  // Set status to review
  await db.update(markets).set({ status: 'review' }).where(eq(markets.id, marketId));

  // Load open markets for H8 dedup check
  const openMarkets = await db
    .select({ id: markets.id, title: markets.title })
    .from(markets)
    .where(eq(markets.status, 'open'));

  // Step 1: Data verification
  const verification = await verifyData(market);

  // Step 2: Rules check
  const rulesCheck = await checkRules(market, verification, openMarkets);

  // Early exit if rejected
  if (rulesCheck.rejected) {
    const review: Review = {
      scores: { ambiguity: 0, timingSafety: 0, timeliness: 0, volumePotential: 0, overallScore: 0 },
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
    return review;
  }

  // Step 3: Score
  const scoring = await scoreMarket(market, verification, rulesCheck);

  // Step 4: Rewrite (conditional)
  const needsRewrite =
    scoring.recommendation === 'rewrite_then_publish' ||
    scoring.scores.ambiguity < 7 ||
    scoring.scores.timingSafety < 7;

  const rewrites = needsRewrite
    ? await rewriteMarket(market, scoring, rulesCheck, verification)
    : undefined;

  // Assemble and save review
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

  return review;
}
