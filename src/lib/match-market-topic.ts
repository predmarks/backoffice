import { db } from '@/db/client';
import { topics } from '@/db/schema';
import { inArray } from 'drizzle-orm';
import { callClaude } from '@/lib/llm';

interface MarketInput {
  id: string;
  title: string;
  category: string;
  description: string;
}

interface TopicMatch {
  topicId: string;
  topicName: string;
}

const OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    matches: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          marketId: { type: 'string' as const },
          topicSlug: { type: 'string' as const, description: 'Slug del tema que mejor coincide, o "none" si ninguno coincide' },
        },
        required: ['marketId', 'topicSlug'] as const,
      },
    },
  },
  required: ['matches'] as const,
};

/**
 * Match markets to existing topics via LLM semantic matching.
 * Returns a map of marketId → { topicId, topicName } or null if no match.
 */
export async function matchMarketsToTopics(
  marketInputs: MarketInput[],
): Promise<Map<string, TopicMatch | null>> {
  const result = new Map<string, TopicMatch | null>();
  if (marketInputs.length === 0) return result;

  // Load all active/regular/stale topics
  const allTopics = await db
    .select({
      id: topics.id,
      name: topics.name,
      slug: topics.slug,
      summary: topics.summary,
      category: topics.category,
    })
    .from(topics)
    .where(inArray(topics.status, ['active', 'regular', 'stale']));

  if (allTopics.length === 0) {
    // No topics to match against — all return null
    for (const m of marketInputs) result.set(m.id, null);
    return result;
  }

  const topicList = allTopics
    .map((t) => `- slug: "${t.slug}" | nombre: ${t.name} | categoría: ${t.category} | resumen: ${t.summary}`)
    .join('\n');

  const marketList = marketInputs
    .map((m) => `- id: "${m.id}" | título: ${m.title} | categoría: ${m.category} | descripción: ${m.description.slice(0, 200)}`)
    .join('\n');

  const system = `Sos un clasificador para Predmarks, una plataforma argentina de mercados de predicción.
Tu tarea es asociar cada mercado con el tema existente que mejor coincida semánticamente.

TEMAS EXISTENTES:
${topicList}

REGLAS:
- Asociá cada mercado al tema que cubra el mismo evento, dominio o entidad
- Usá el slug del tema como identificador
- Si ningún tema coincide razonablemente, devolvé "none" como topicSlug
- No fuerces coincidencias débiles — es mejor "none" que un match incorrecto`;

  try {
    const { result: llmResult } = await callClaude<{ matches: { marketId: string; topicSlug: string }[] }>({
      system,
      userMessage: `Asociá estos mercados con los temas existentes:\n${marketList}`,
      outputSchema: OUTPUT_SCHEMA,
      operation: 'match_markets_topics',
    });

    // Build slug → topic lookup
    const slugMap = new Map(allTopics.map((t) => [t.slug, t]));

    for (const match of llmResult.matches) {
      const topic = match.topicSlug !== 'none' ? slugMap.get(match.topicSlug) : null;
      result.set(
        match.marketId,
        topic ? { topicId: topic.id, topicName: topic.name } : null,
      );
    }

    // Ensure all inputs have an entry
    for (const m of marketInputs) {
      if (!result.has(m.id)) result.set(m.id, null);
    }
  } catch {
    // LLM failure — all return null (will trigger async research)
    for (const m of marketInputs) result.set(m.id, null);
  }

  return result;
}
