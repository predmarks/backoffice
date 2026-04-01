import { inngest } from './client';

export const cronIngestLight = inngest.createFunction(
  { id: 'cron-signal-ingestion-light' },
  { cron: '0 * * * *' },
  async ({ step }) => {
    await step.sendEvent('trigger-ingestion-light', {
      name: 'signals/ingest-light.requested',
      data: {},
    });
    return { triggered: true };
  },
);
