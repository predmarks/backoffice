import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { db } from '@/db/client';
import { topics, topicSignals, signals, topicConversations, globalFeedback } from '@/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { rescoreTopic } from '@/agents/sourcer/scorer';
import { HARD_RULES, SOFT_RULES } from '@/config/rules';

const client = new Anthropic({ maxRetries: 2 });

const SYSTEM_PROMPT = `Sos un analista de mercados predictivos para Predmarks, una plataforma argentina de mercados de predicción.
Estás conversando sobre un TEMA específico del que se pueden derivar mercados predictivos. Tenés contexto completo del tema, sus señales, ángulos sugeridos y feedback previo.

Tu rol:
- Respondé en español argentino, breve y directo.
- Ayudá al editor a analizar el tema, evaluar ángulos, discutir timing, y refinar ideas de mercados.
- Si el editor da feedback sobre el tema, guardalo con save_feedback.
- Extraé aprendizajes globales que apliquen a TODOS los temas/mercados futuros (si hay). No dupliques los existentes.
- Podés guardar feedback varias veces en la misma conversación.
- Sé conversacional, no robótico.`;

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'respond',
    description: 'Respond to the user with a message',
    input_schema: {
      type: 'object' as const,
      properties: {
        message: { type: 'string' as const, description: 'Your response to the user' },
      },
      required: ['message'],
    },
  },
  {
    name: 'save_feedback',
    description: 'Save feedback about this topic. Call when you understand the user\'s intent.',
    input_schema: {
      type: 'object' as const,
      properties: {
        topic_feedback: {
          type: 'string' as const,
          description: 'Clear, actionable feedback about this topic for the sourcer/generator agents',
        },
        global_learnings: {
          type: 'array' as const,
          items: { type: 'string' as const },
          description: 'Generalizable learnings for ALL future topics/markets. Empty array if topic-specific only.',
        },
      },
      required: ['topic_feedback', 'global_learnings'],
    },
  },
];

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// GET: list conversations for a topic
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const conversations = await db
    .select()
    .from(topicConversations)
    .where(eq(topicConversations.topicId, id))
    .orderBy(desc(topicConversations.updatedAt));

  return NextResponse.json({
    conversations: conversations.map((c) => ({
      id: c.id,
      title: c.title,
      messages: c.messages,
      updatedAt: c.updatedAt.toISOString(),
    })),
  });
}

// POST: send a message in a conversation
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const messages: ChatMessage[] = body.messages ?? [];
  const conversationId: string | undefined = body.conversationId;

  if (!messages.length || messages[messages.length - 1].role !== 'user') {
    return NextResponse.json({ error: 'Last message must be from user' }, { status: 400 });
  }

  // Load topic
  const [topic] = await db.select().from(topics).where(eq(topics.id, id));
  if (!topic) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 });
  }

  // Load linked signals (up to 20)
  const linkedSignals = await db
    .select({ text: signals.text, source: signals.source, publishedAt: signals.publishedAt })
    .from(topicSignals)
    .innerJoin(signals, eq(topicSignals.signalId, signals.id))
    .where(eq(topicSignals.topicId, id))
    .orderBy(desc(signals.publishedAt))
    .limit(20);

  // Load existing global feedback for dedup
  const existingGlobal = await db.select().from(globalFeedback);
  const existingGlobalTexts = existingGlobal.map((r) => r.text);

  const feedbackEntries = (topic.feedback ?? []) as { text: string; createdAt: string }[];

  const signalsContext = linkedSignals.length > 0
    ? linkedSignals.map((s, i) => `${i + 1}. [${s.source}] ${s.text} (${s.publishedAt.toISOString().split('T')[0]})`).join('\n')
    : 'Sin señales vinculadas.';

  const feedbackContext = feedbackEntries.length > 0
    ? feedbackEntries.map((f) => `- ${f.text}`).join('\n')
    : 'Sin feedback previo.';

  const systemMessage = `${SYSTEM_PROMPT}

TEMA EN CUESTIÓN:
- Nombre: ${topic.name}
- Categoría: ${topic.category}
- Score: ${topic.score}/10
- Estado: ${topic.status}
- Resumen: ${topic.summary}

ÁNGULOS SUGERIDOS:
${topic.suggestedAngles.length > 0 ? topic.suggestedAngles.map((a) => `- ${a}`).join('\n') : 'Sin ángulos.'}

SEÑALES VINCULADAS (${linkedSignals.length}):
${signalsContext}

FEEDBACK PREVIO DEL EDITOR:
${feedbackContext}

REGLAS DE VALIDACIÓN (referencia):
Estrictas: ${HARD_RULES.map((r) => `${r.id}: ${r.description}`).join(' | ')}
Advertencias: ${SOFT_RULES.map((r) => `${r.id}: ${r.description}`).join(' | ')}

FEEDBACK GLOBAL EXISTENTE (no duplicar):
${existingGlobalTexts.length > 0 ? existingGlobalTexts.map((t, i) => `${i + 1}. ${t}`).join('\n') : 'Ninguno.'}`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: systemMessage,
    tools: TOOLS,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });

  // Collect reply text and save actions
  const replyParts: string[] = [];
  const saveActions: { topic_feedback: string; global_learnings: string[] }[] = [];

  for (const block of response.content) {
    if (block.type === 'text' && block.text.trim()) {
      replyParts.push(block.text.trim());
    }
    if (block.type === 'tool_use' && block.name === 'respond') {
      replyParts.push((block.input as { message: string }).message);
    }
    if (block.type === 'tool_use' && block.name === 'save_feedback') {
      saveActions.push(block.input as { topic_feedback: string; global_learnings: string[] });
    }
  }

  const reply = replyParts.join('\n\n') || 'No entendí, ¿podés reformular?';
  const fullConversation: ChatMessage[] = [...messages, { role: 'assistant', content: reply }];

  // Persist save actions
  for (const action of saveActions) {
    // Append feedback to topic
    const entry = JSON.stringify([{ text: action.topic_feedback, createdAt: new Date().toISOString() }]);
    await db
      .update(topics)
      .set({
        feedback: sql`COALESCE(${topics.feedback}, '[]'::jsonb) || ${entry}::jsonb`,
        updatedAt: new Date(),
      })
      .where(eq(topics.id, id));

    // Rescore topic
    const allFeedback = [...feedbackEntries, { text: action.topic_feedback, createdAt: new Date().toISOString() }];
    const { score } = await rescoreTopic(
      { name: topic.name, summary: topic.summary, category: topic.category },
      allFeedback,
    );

    await db
      .update(topics)
      .set({
        score,
        status: score < 2 ? 'stale' : topic.status,
        updatedAt: new Date(),
      })
      .where(eq(topics.id, id));

    // Save global learnings
    if (action.global_learnings.length > 0) {
      await db.insert(globalFeedback).values(
        action.global_learnings.map((text) => ({ text })),
      );
    }
  }

  // Persist conversation
  const title = messages[0].content.slice(0, 80);
  if (conversationId) {
    await db
      .update(topicConversations)
      .set({ messages: fullConversation, updatedAt: new Date() })
      .where(eq(topicConversations.id, conversationId));
  } else {
    const [created] = await db
      .insert(topicConversations)
      .values({ topicId: id, title, messages: fullConversation })
      .returning({ id: topicConversations.id });
    return NextResponse.json({ reply, conversation: fullConversation, conversationId: created.id });
  }

  return NextResponse.json({ reply, conversation: fullConversation, conversationId });
}
