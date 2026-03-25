import { serve } from 'inngest/next';
import { inngest } from '@/inngest/client';
import { reviewJob } from '@/inngest/review-job';
import { ingestionJob } from '@/inngest/ingestion-job';
import { generationJob } from '@/inngest/generation-job';
import { suggestTopicJob } from '@/inngest/suggest-topic-job';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [reviewJob, ingestionJob, generationJob, suggestTopicJob],
});
