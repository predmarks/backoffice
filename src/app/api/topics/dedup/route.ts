import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { topics } from '@/db/schema';
import { eq, inArray } from 'drizzle-orm';
import { getEmbeddings, cosineSimilarity } from '@/agents/sourcer/deduplication';
import OpenAI from 'openai';

const EMBEDDING_BATCH_SIZE = 50;

const SIMILARITY_THRESHOLD = 0.80;

export async function GET() {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OPENAI_API_KEY not set' }, { status: 500 });
  }

  const allTopics = await db
    .select({
      id: topics.id, name: topics.name, slug: topics.slug, summary: topics.summary,
      status: topics.status, score: topics.score, embedding: topics.embedding,
      suggestedAngles: topics.suggestedAngles, signalCount: topics.signalCount, category: topics.category,
    })
    .from(topics)
    .where(inArray(topics.status, ['active', 'regular', 'stale']));

  if (allTopics.length < 2) {
    return NextResponse.json({ pairs: [], message: 'Not enough topics to compare' });
  }

  const openai = new OpenAI();

  // Get embeddings — use cached where available
  const needsEmbedding = allTopics.filter((t) => !t.embedding);
  const cachedEmbeddings = new Map<string, number[]>();
  for (const t of allTopics) {
    if (t.embedding) cachedEmbeddings.set(t.id, t.embedding as number[]);
  }

  if (needsEmbedding.length > 0) {
    // Batch embedding requests to avoid timeouts
    for (let batch = 0; batch < needsEmbedding.length; batch += EMBEDDING_BATCH_SIZE) {
      const slice = needsEmbedding.slice(batch, batch + EMBEDDING_BATCH_SIZE);
      const texts = slice.map((t) => `${t.name}: ${t.summary}`);
      const embeddings = await getEmbeddings(openai, texts);
      for (let i = 0; i < slice.length; i++) {
        cachedEmbeddings.set(slice[i].id, embeddings[i]);
        // Cache in DB for next time
        await db.update(topics).set({ embedding: embeddings[i] }).where(eq(topics.id, slice[i].id));
      }
    }
  }

  // Find similar pairs
  type TopicInfo = { id: string; name: string; slug: string; status: string; score: number; summary: string; suggestedAngles: string[]; signalCount: number; category: string };
  const pairs: { a: TopicInfo; b: TopicInfo; similarity: number }[] = [];

  const toInfo = (t: typeof allTopics[number]): TopicInfo => ({
    id: t.id, name: t.name, slug: t.slug, status: t.status, score: t.score,
    summary: t.summary, suggestedAngles: t.suggestedAngles, signalCount: t.signalCount, category: t.category,
  });

  for (let i = 0; i < allTopics.length; i++) {
    for (let j = i + 1; j < allTopics.length; j++) {
      const embA = cachedEmbeddings.get(allTopics[i].id);
      const embB = cachedEmbeddings.get(allTopics[j].id);
      if (!embA || !embB) continue;

      const sim = cosineSimilarity(embA, embB);
      if (sim > SIMILARITY_THRESHOLD) {
        pairs.push({ a: toInfo(allTopics[i]), b: toInfo(allTopics[j]), similarity: Math.round(sim * 100) / 100 });
      }
    }
  }

  pairs.sort((a, b) => b.similarity - a.similarity);

  return NextResponse.json({
    totalTopics: allTopics.length,
    duplicatePairs: pairs.length,
    pairs,
  });
}
