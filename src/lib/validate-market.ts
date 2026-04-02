const VALID_CATEGORIES = ['Política', 'Economía', 'Deportes', 'Entretenimiento', 'Clima', 'Otros'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY = 86400;

interface MarketLike {
  endTimestamp: number;
  expectedResolutionDate?: string | null;
  category?: string;
  outcomes?: string[];
  title?: string;
}

interface Fix {
  from: unknown;
  to: unknown;
  reason: string;
}

export interface ValidationResult {
  fixes: Record<string, Fix>;
  warnings: string[];
}

export function validateMarket(market: MarketLike, nowTs?: number): ValidationResult {
  const now = nowTs ?? Math.floor(Date.now() / 1000);
  const fixes: Record<string, Fix> = {};
  const warnings: string[] = [];

  // 1. endTimestamp in the past → fix to 30 days from now
  if (market.endTimestamp <= now) {
    const fixed = now + 30 * DAY;
    fixes.endTimestamp = { from: market.endTimestamp, to: fixed, reason: `Timestamp ${market.endTimestamp} (${new Date(market.endTimestamp * 1000).toISOString()}) está en el pasado` };
    market.endTimestamp = fixed;
  }

  // 2. endTimestamp too far (>120 days)
  if (market.endTimestamp > now + 120 * DAY) {
    warnings.push(`endTimestamp está a más de 120 días (${new Date(market.endTimestamp * 1000).toISOString()})`);
  }

  // 3. endTimestamp too soon (<7 days)
  if (market.endTimestamp < now + 7 * DAY) {
    warnings.push(`endTimestamp está a menos de 7 días (${new Date(market.endTimestamp * 1000).toISOString()})`);
  }

  // 4. expectedResolutionDate invalid format → derive from endTimestamp
  if (market.expectedResolutionDate != null) {
    if (!DATE_RE.test(market.expectedResolutionDate)) {
      const derived = new Date(market.endTimestamp * 1000).toISOString().split('T')[0];
      fixes.expectedResolutionDate = { from: market.expectedResolutionDate, to: derived, reason: `Formato inválido, derivado de endTimestamp` };
      market.expectedResolutionDate = derived;
    }
  }

  // 5. expectedResolutionDate before endTimestamp → fix
  if (market.expectedResolutionDate && DATE_RE.test(market.expectedResolutionDate)) {
    const resDate = new Date(market.expectedResolutionDate + 'T23:59:59Z');
    const endDate = new Date(market.endTimestamp * 1000);
    if (resDate < endDate) {
      // Resolution date should be on or after market close
      const derived = endDate.toISOString().split('T')[0];
      fixes.expectedResolutionDate = { from: market.expectedResolutionDate, to: derived, reason: `Fecha de resolución anterior al cierre, ajustada` };
      market.expectedResolutionDate = derived;
    }
  }

  // 6. Invalid category → fix to 'Otros'
  if (market.category && !VALID_CATEGORIES.includes(market.category)) {
    fixes.category = { from: market.category, to: 'Otros', reason: `Categoría "${market.category}" inválida` };
    market.category = 'Otros';
  }

  // 7. Empty outcomes → fix to binary
  if (market.outcomes && market.outcomes.length === 0) {
    fixes.outcomes = { from: [], to: ['Si', 'No'], reason: 'Outcomes vacío, default binario' };
    market.outcomes = ['Si', 'No'];
  }

  // 8. Multi-outcome without "Otro"
  if (market.outcomes && market.outcomes.length > 2 && !market.outcomes.includes('Otro')) {
    warnings.push(`Multi-opción sin "Otro" — verificar si outcomes son exhaustivos`);
  }

  // 9. Title missing question mark
  if (market.title && !market.title.includes('?') && !market.title.includes('¿')) {
    warnings.push(`Título sin signo de interrogación`);
  }

  return { fixes, warnings };
}
