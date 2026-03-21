import { callClaude } from '@/lib/llm';
import type { SourceSignal } from './types';

const SYSTEM_PROMPT = `Sos un evaluador de señales para Predmarks, una plataforma argentina de mercados de predicción.
Tu trabajo es puntuar señales (noticias, tendencias, datos económicos) por su potencial para generar buenos mercados predictivos.

Criterios de puntuación (0-10):
- **Controversia**: ¿Ambos resultados (sí/no) son plausibles? (0 = obvio, 10 = muy divisivo)
- **Temporalidad**: ¿Se puede resolver en días/semanas? (0 = vago/lejano, 10 = fecha clara próxima)
- **Interés**: ¿Le importa a la audiencia argentina? (0 = irrelevante, 10 = tema caliente)
- **Medibilidad**: ¿Se puede verificar con fuente pública? (0 = subjetivo, 10 = dato duro)

Score final = promedio de los 4 criterios.

Descartá (score 0) señales que:
- Son puramente informativas sin ángulo predictivo
- Son demasiado vagas para generar un mercado concreto
- Ya ocurrieron (el resultado ya se conoce)`;

const OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    scores: {
      type: 'array' as const,
      items: {
        type: 'object' as const,
        properties: {
          index: { type: 'number' as const, description: 'Índice de la señal (1-based)' },
          score: { type: 'number' as const, description: 'Score 0-10' },
          reason: { type: 'string' as const, description: 'Razón breve del score' },
        },
        required: ['index', 'score', 'reason'] as const,
      },
    },
  },
  required: ['scores'] as const,
};

interface ScoreResult {
  index: number;
  score: number;
  reason: string;
}

export async function scoreSignals(signals: SourceSignal[]): Promise<SourceSignal[]> {
  if (signals.length === 0) return [];

  const signalList = signals
    .map((s, i) => {
      const parts = [`${i + 1}. [${s.source}] [${s.type}] ${s.text}`];
      if (s.summary) parts.push(`   ${s.summary.slice(0, 200)}`);
      return parts.join('\n');
    })
    .join('\n');

  const today = new Date().toISOString().split('T')[0];

  const { result } = await callClaude<{ scores: ScoreResult[] }>({
    system: SYSTEM_PROMPT,
    userMessage: `HOY: ${today}\n\nSEÑALES A EVALUAR:\n${signalList}`,
    outputSchema: OUTPUT_SCHEMA,
    outputToolName: 'score_signals',
  });

  // Apply scores to signals
  const scoreMap = new Map(result.scores.map((s) => [s.index, s]));
  return signals.map((signal, i) => {
    const scored = scoreMap.get(i + 1);
    return {
      ...signal,
      score: scored?.score ?? 0,
      scoreReason: scored?.reason ?? '',
    };
  });
}
