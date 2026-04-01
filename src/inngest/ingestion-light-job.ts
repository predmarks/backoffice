import { inngest } from './client';
import { ingestAllSources } from '@/agents/sourcer/ingestion';
import { logActivity } from '@/lib/activity-log';

export const ingestionLightJob = inngest.createFunction(
  { id: 'ingestion-light', retries: 3, concurrency: { limit: 1 } },
  { event: 'signals/ingest-light.requested' },
  async ({ step }) => {
    const result = await step.run('ingest', async () => {
      const { signals } = await ingestAllSources();

      const signalsBySource: Record<string, number> = {};
      for (const s of signals) {
        signalsBySource[s.source] = (signalsBySource[s.source] ?? 0) + 1;
      }

      await logActivity('ingestion_light_completed', {
        entityType: 'system',
        entityLabel: `${signals.length} señales`,
        detail: { signalsCount: signals.length, signalsBySource },
        source: 'pipeline',
      });

      return { signalsCount: signals.length, signalsBySource };
    });

    return { status: 'complete', ...result };
  },
);
