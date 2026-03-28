import type { MarketCategory } from '@/db/types';

export interface RSSFeed {
  name: string;
  url: string;
  category?: MarketCategory;
}

export const RSS_FEEDS: RSSFeed[] = [
  // Clarín — section feeds (lo-ultimo only returns weather spam)
  { name: 'Clarín', url: 'https://www.clarin.com/rss/politica/', category: 'Política' },
  { name: 'Clarín', url: 'https://www.clarin.com/rss/economia/', category: 'Economía' },
  { name: 'Clarín', url: 'https://www.clarin.com/rss/deportes/', category: 'Deportes' },
  { name: 'Clarín', url: 'https://www.clarin.com/rss/sociedad/' },
  { name: 'Clarín', url: 'https://www.clarin.com/rss/mundo/' },
  { name: 'Clarín', url: 'https://www.clarin.com/rss/espectaculos/', category: 'Entretenimiento' },
  // La Nación — canonical redirect URL
  { name: 'La Nación', url: 'https://www.lanacion.com.ar/arc/outboundfeeds/rss/?outputType=xml' },
  { name: 'Infobae', url: 'https://www.infobae.com/arc/outboundfeeds/rss/' },
  { name: 'El Cronista', url: 'https://www.cronista.com/arc/outboundfeeds/rss/', category: 'Economía' },
  { name: 'Ámbito Financiero', url: 'https://www.ambito.com/rss/pages/economia.xml', category: 'Economía' },
  // Additional sources
  { name: 'Chequeado', url: 'https://chequeado.com/feed/' },
  { name: 'Perfil', url: 'https://www.perfil.com/feed' },
  // Sports — official & specialized
  { name: 'CONMEBOL', url: 'https://www.conmebol.com/feed/', category: 'Deportes' },
  { name: 'Olé', url: 'https://www.ole.com.ar/rss/ultimas-noticias/', category: 'Deportes' },
];

// BCRA API v4.0: /estadisticas/v4.0/Monetarias/{idVariable}?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
// Variable IDs: 1 = Reservas Internacionales, 4 = Tipo de Cambio Minorista, 15 = Base Monetaria
export interface BCRAVariable {
  id: number;
  metric: string;
  unit: string;
}

export const BCRA_VARIABLES: BCRAVariable[] = [
  { id: 1, metric: 'Reservas Internacionales BCRA', unit: 'USD millones' },
  { id: 4, metric: 'Dólar Oficial (minorista)', unit: 'ARS' },
  { id: 15, metric: 'Base Monetaria', unit: 'ARS millones' },
];

export const BCRA_API_BASE = 'https://api.bcra.gob.ar/estadisticas/v4.0/Monetarias';

export const AMBITO_DOLAR_BLUE_URL = 'https://mercados.ambito.com/dolar/informal/variacion';
export const AMBITO_RIESGO_PAIS_URL = 'https://mercados.ambito.com/riesgopais/variacion';

// Twitter/X API
export const X_BEARER_TOKEN = process.env.X_BEARER_TOKEN ?? '';
export const X_TRENDS_WOEID = 23424747; // Argentina
