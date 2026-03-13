import { callClaude } from '@/lib/llm';
import { CONTINGENCY_TEMPLATES } from '@/config/contingencies';
import type { SuggestedRewrites } from '@/db/types';
import type { DataVerificationResult } from './data-verifier';
import type { RulesCheckResult } from './rules-checker';
import type { ScoringResult } from './scorer';
import type { MarketRecord } from './types';

const SYSTEM_PROMPT = `Sos un editor experto de mercados predictivos para Predmarks, una plataforma argentina de mercados de predicción.
Tu trabajo es mejorar mercados candidatos que necesitan ajustes antes de ser publicados.
NUNCA inventar datos. Si necesitás un número que no tenés, escribí "[VERIFICAR: descripción del dato necesario]".`;

const OUTPUT_SCHEMA = {
  type: 'object' as const,
  properties: {
    title: { type: 'string' as const, description: 'Rewritten title, or empty string if no change needed' },
    description: { type: 'string' as const, description: 'Rewritten description, or empty string if no change needed' },
    resolutionCriteria: { type: 'string' as const, description: 'Rewritten resolution criteria, or empty string if no change needed' },
    contingencies: { type: 'string' as const, description: 'Rewritten contingencies, or empty string if no change needed' },
  },
  required: ['title', 'description', 'resolutionCriteria', 'contingencies'] as const,
};

function formatContingencyTemplates(): string {
  const examples: Record<string, string> = {
    lagged_data_period: CONTINGENCY_TEMPLATES.lagged_data_period('reservas internacionales', 'cierre de febrero 2026', 'el BCRA'),
    source_unavailable: CONTINGENCY_TEMPLATES.source_unavailable('la fuente principal'),
    holiday_fallback: CONTINGENCY_TEMPLATES.holiday_fallback('la fuente'),
    sports_rescheduling: CONTINGENCY_TEMPLATES.sports_rescheduling('el partido'),
    regulation_time_only: CONTINGENCY_TEMPLATES.regulation_time_only(),
    event_cancelled: CONTINGENCY_TEMPLATES.event_cancelled('el evento'),
    event_postponed: CONTINGENCY_TEMPLATES.event_postponed('el evento'),
    event_rescheduled_earlier: CONTINGENCY_TEMPLATES.event_rescheduled_earlier('el evento'),
    data_revision: CONTINGENCY_TEMPLATES.data_revision(),
  };
  return Object.entries(examples)
    .map(([name, text]) => `- ${name}: "${text}"`)
    .join('\n');
}

export async function rewriteMarket(
  market: MarketRecord,
  scoring: ScoringResult,
  rulesCheck: RulesCheckResult,
  dataVerification: DataVerificationResult,
): Promise<SuggestedRewrites> {
  const marketSummary = {
    title: market.title,
    description: market.description,
    resolutionCriteria: market.resolutionCriteria,
    resolutionSource: market.resolutionSource,
    contingencies: market.contingencies,
    category: market.category,
    endTimestamp: market.endTimestamp,
    endDate: new Date(market.endTimestamp * 1000).toISOString(),
  };

  const problems: string[] = [];

  // Collect rule violations
  const failedHard = rulesCheck.hardRuleResults.filter((r) => !r.passed);
  if (failedHard.length > 0) {
    problems.push(
      `Reglas estrictas falladas: ${failedHard.map((r) => `${r.ruleId}: ${r.explanation}`).join('; ')}`,
    );
  }
  const failedSoft = rulesCheck.softRuleResults.filter((r) => !r.passed);
  if (failedSoft.length > 0) {
    problems.push(
      `Advertencias blandas: ${failedSoft.map((r) => `${r.ruleId}: ${r.explanation}`).join('; ')}`,
    );
  }

  // Collect scoring issues
  if (scoring.scores.ambiguity < 7) {
    problems.push(`Ambigüedad baja (${scoring.scores.ambiguity}/10)`);
  }
  if (scoring.scores.timingSafety < 7) {
    problems.push(`Seguridad de timing baja (${scoring.scores.timingSafety}/10)`);
  }

  // Collect data verification issues
  const inaccurate = dataVerification.claims.filter((c) => !c.isAccurate);
  if (inaccurate.length > 0) {
    problems.push(
      `Datos inexactos: ${inaccurate.map((c) => `${c.claim} (actual: ${c.currentValue})`).join('; ')}`,
    );
  }

  const userMessage = `Mejorá este mercado. Prioridades:

1. TIMING: Si hay riesgo de que se resuelva con el mercado abierto,
   reenmarcá para eliminarlo. Ajustá el endTimestamp si es necesario.

2. CRITERIOS: Hacé la resolución hermética:
   - Citá fuente pública específica con URL
   - Incluí hora argentina (UTC-3) si aplica
   - Cubrí los casos borde con contingencias estándar
   - Formato: 'Este mercado se resolverá como "Sí" si... Se resolverá como "No" si...'

3. CONTINGENCIAS: Incluí las cláusulas estándar que apliquen:
   - Fuente no disponible → fuente alternativa o última disponible
   - Evento cancelado → "No"
   - Revisión de datos → primera publicación
   - Deportes → tiempo reglamentario

4. TÍTULO: Hacelo más claro y atractivo.

5. DESCRIPCIÓN: Agregá contexto relevante (1-2 oraciones).

Cláusulas de contingencia estándar disponibles:
${formatContingencyTemplates()}

Mercado original:
${JSON.stringify(marketSummary, null, 2)}

Problemas detectados:
${problems.join('\n')}

Si un campo no necesita cambios, devolvé un string vacío para ese campo.`;

  const { result } = await callClaude<{
    title: string;
    description: string;
    resolutionCriteria: string;
    contingencies: string;
  }>({
    system: SYSTEM_PROMPT,
    userMessage,
    outputSchema: OUTPUT_SCHEMA,
  });

  // Convert empty strings to undefined (no change)
  const rewrites: SuggestedRewrites = {};
  if (result.title) rewrites.title = result.title;
  if (result.description) rewrites.description = result.description;
  if (result.resolutionCriteria) rewrites.resolutionCriteria = result.resolutionCriteria;
  if (result.contingencies) rewrites.contingencies = result.contingencies;

  return rewrites;
}
