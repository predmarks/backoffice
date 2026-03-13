export const MARKET_STATUSES = [
  'candidate',
  'review',
  'approved',
  'open',
  'closed',
  'resolved',
  'rejected',
] as const;
export type MarketStatus = (typeof MARKET_STATUSES)[number];

export const MARKET_CATEGORIES = [
  'Política',
  'Economía',
  'Deportes',
  'Entretenimiento',
  'Clima',
] as const;
export type MarketCategory = (typeof MARKET_CATEGORIES)[number];

export type TimingSafety = 'safe' | 'caution' | 'dangerous';

export interface SourceContext {
  originType: 'news' | 'social' | 'event_calendar' | 'trending' | 'data_api' | 'manual';
  originUrl?: string;
  originText?: string;
  generatedAt: string;
}

export interface ReviewScores {
  ambiguity: number;
  timingSafety: number;
  timeliness: number;
  volumePotential: number;
  overallScore: number;
}

export interface RuleResult {
  ruleId: string;
  passed: boolean;
  explanation: string;
}

export interface DataVerification {
  claim: string;
  currentValue: string;
  source: string;
  sourceUrl?: string;
  isAccurate: boolean;
  severity: 'critical' | 'minor';
}

export interface ResolutionSourceCheck {
  exists: boolean;
  accessible: boolean;
  publishesRelevantData: boolean;
  url: string;
  note: string;
}

export interface SuggestedRewrites {
  title?: string;
  description?: string;
  resolutionCriteria?: string;
  contingencies?: string;
}

export interface Review {
  scores: ReviewScores;
  hardRuleResults: RuleResult[];
  softRuleResults: RuleResult[];
  dataVerification: DataVerification[];
  resolutionSourceCheck?: ResolutionSourceCheck;
  suggestedRewrites?: SuggestedRewrites;
  recommendation?: 'publish' | 'rewrite_then_publish' | 'hold' | 'reject';
  reviewedAt: string;
}

export interface Resolution {
  evidence: string;
  evidenceUrls: string[];
  confidence: 'high' | 'medium' | 'low';
  suggestedOutcome: 'Si' | 'No';
  flaggedAt: string;
  confirmedBy?: string;
  confirmedAt?: string;
}

export interface Market {
  id: string;
  status: MarketStatus;
  title: string;
  description: string;
  resolutionCriteria: string;
  resolutionSource: string;
  contingencies: string;
  category: MarketCategory;
  tags: string[];
  outcomes: ['Si', 'No'];
  endTimestamp: number;
  expectedResolutionDate?: string | null;
  timingSafety: TimingSafety;
  createdAt: Date;
  publishedAt?: Date | null;
  closedAt?: Date | null;
  resolvedAt?: Date | null;
  outcome?: 'Si' | 'No' | null;
  sourceContext: SourceContext;
  review?: Review | null;
  resolution?: Resolution | null;
}

export interface DeployableMarket {
  name: string;
  description: string;
  category: string;
  outcomes: ['Si', 'No'];
  endTimestamp: number;
}
