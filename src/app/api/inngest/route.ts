import { serve } from 'inngest/next';
import { inngest } from '@/inngest/client';
import { reviewJob } from '@/inngest/review-job';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [reviewJob],
});
