import { inngest } from './client';
import { db } from '@/db/client';
import { sourcingRuns, topics as topicsTable, topicSignals } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { ingestAllSources, markSignalsUsed } from '@/agents/sourcer/ingestion';
import { updateTopics, markStaleTopics } from '@/agents/sourcer/topic-extractor';
import type { SourcingStep } from '@/db/types';
import type { Topic } from '@/agents/sourcer/types';

const STEP_NAMES = ['ingest', 'update-topics'] as const;

function buildSteps(currentIdx: number, detail?: string): SourcingStep[] {
  return STEP_NAMES.map((name, i) => ({
    name,
    status: i < currentIdx ? 'done' : i === currentIdx ? 'running' : 'pending',
    ...(i === currentIdx && detail ? { detail } : {}),
  }));
}

export const ingestionJob = inngest.createFunction(
  { id: 'ingestion-pipeline', retries: 1 },
  { event: 'signals/ingest.requested' },
  async ({ step }) => {
    // Create run record
    const runId = await step.run('init-run', async () => {
      const [run] = await db
        .insert(sourcingRuns)
        .values({
          status: 'running',
          currentStep: 'ingest',
          steps: buildSteps(0),
        })
        .returning({ id: sourcingRuns.id });
      return run.id;
    });

    async function updateRun(stepIdx: number, updates: Partial<typeof sourcingRuns.$inferInsert> = {}) {
      await db
        .update(sourcingRuns)
        .set({
          currentStep: STEP_NAMES[stepIdx] ?? 'done',
          steps: buildSteps(stepIdx, updates.error ?? undefined),
          ...updates,
        })
        .where(eq(sourcingRuns.id, runId));
    }

    try {
      // Step 0: Ingest
      const ingestionResult = await step.run('ingest', async () => {
        await updateRun(0);
        const result = await ingestAllSources();
        await db
          .update(sourcingRuns)
          .set({ signals: result.signals, signalsCount: result.signals.length })
          .where(eq(sourcingRuns.id, runId));
        return result;
      });

      // Mark all signals as used in this run
      await step.run('mark-signals-used', async () => {
        const signalIds = ingestionResult.signals.map((s) => s.id).filter(Boolean) as string[];
        await markSignalsUsed(signalIds, runId);
      });

      // Step 1: Update topics
      const freshTopicIds = await step.run('update-topics', async () => {
        await updateRun(1);

        // Load existing active topics from DB
        const existingTopicRows = await db
          .select()
          .from(topicsTable)
          .where(eq(topicsTable.status, 'active'));

        const existingTopics: Topic[] = existingTopicRows.map((row) => ({
          id: row.id,
          name: row.name,
          slug: row.slug,
          summary: row.summary,
          signalIndices: [],
          suggestedAngles: row.suggestedAngles,
          category: row.category as Topic['category'],
          score: row.score,
          status: row.status as Topic['status'],
          signalCount: row.signalCount,
          lastSignalAt: row.lastSignalAt?.toISOString(),
          lastGeneratedAt: row.lastGeneratedAt?.toISOString(),
        }));

        // Call LLM to match/create topics
        const topicUpdates = await updateTopics(ingestionResult.signals, existingTopics);

        const now = new Date();
        const updatedTopicIds: string[] = [];

        // Build a map of signal indices to signal DB IDs
        const signalIdMap = new Map<number, string>();
        ingestionResult.signals.forEach((s, i) => {
          if (s.id) signalIdMap.set(i + 1, s.id);
        });

        const signalsWithIds = ingestionResult.signals.filter((s) => s.id).length;
        console.log(`Signal ID map: ${signalIdMap.size} of ${ingestionResult.signals.length} signals have DB IDs`);

        for (const update of topicUpdates) {
          const linkedCount = update.signalIndices.filter((idx) => signalIdMap.has(idx)).length;
          console.log(`Topic "${update.name}" (${update.action}): ${update.signalIndices.length} signal indices, ${linkedCount} resolved to DB IDs`);
          if (update.signalIndices.length === 0) {
            console.warn(`Topic "${update.name}" has EMPTY signalIndices — signals won't be linked`);
          }

          if (update.action === 'update' && update.existingTopicSlug) {
            // Find the existing topic by slug
            const existing = existingTopicRows.find((t) => t.slug === update.existingTopicSlug);
            if (!existing) continue;

            await db
              .update(topicsTable)
              .set({
                summary: update.summary,
                score: update.score,
                suggestedAngles: update.suggestedAngles,
                signalCount: existing.signalCount + update.signalIndices.length,
                lastSignalAt: now,
                updatedAt: now,
              })
              .where(eq(topicsTable.id, existing.id));

            // Insert new topic_signals entries
            for (const idx of update.signalIndices) {
              const signalId = signalIdMap.get(idx);
              if (signalId) {
                await db
                  .insert(topicSignals)
                  .values({ topicId: existing.id, signalId })
                  .onConflictDoNothing();
              }
            }

            updatedTopicIds.push(existing.id);
          } else if (update.action === 'create') {
            // Insert new topic
            const [inserted] = await db
              .insert(topicsTable)
              .values({
                name: update.name,
                slug: update.slug,
                summary: update.summary,
                category: update.category,
                suggestedAngles: update.suggestedAngles,
                score: update.score,
                status: 'active',
                signalCount: update.signalIndices.length,
                lastSignalAt: now,
              })
              .onConflictDoNothing()
              .returning({ id: topicsTable.id });

            if (inserted) {
              // Insert topic_signals entries
              for (const idx of update.signalIndices) {
                const signalId = signalIdMap.get(idx);
                if (signalId) {
                  await db
                    .insert(topicSignals)
                    .values({ topicId: inserted.id, signalId })
                    .onConflictDoNothing();
                }
              }
              updatedTopicIds.push(inserted.id);
            }
          }
        }

        // Mark stale topics
        await markStaleTopics();

        return updatedTopicIds;
      });

      // Mark complete
      await step.run('mark-complete', async () => {
        await db
          .update(sourcingRuns)
          .set({
            status: 'complete',
            currentStep: 'done',
            steps: STEP_NAMES.map((name) => ({ name, status: 'done' as const })),
            completedAt: new Date(),
          })
          .where(eq(sourcingRuns.id, runId));
      });

      return { status: 'complete', runId, topicIds: freshTopicIds };
    } catch (err) {
      // Mark run as failed
      await db
        .update(sourcingRuns)
        .set({
          status: 'error',
          error: err instanceof Error ? err.message : String(err),
          completedAt: new Date(),
        })
        .where(eq(sourcingRuns.id, runId));
      throw err;
    }
  },
);
