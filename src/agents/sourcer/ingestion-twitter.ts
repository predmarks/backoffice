import { X_BEARER_TOKEN, X_TRENDS_WOEID } from '@/config/sources';
import type { SourceSignal } from './types';

interface XTrendV2 {
  trend_name: string;
}

export async function ingestTwitter(): Promise<SourceSignal[]> {
  if (!X_BEARER_TOKEN) {
    console.warn('X_BEARER_TOKEN not set, skipping Twitter ingestion');
    return [];
  }

  try {
    const res = await fetch(
      `https://api.twitter.com/2/trends/by/woeid/${X_TRENDS_WOEID}`,
      {
        headers: { Authorization: `Bearer ${X_BEARER_TOKEN}` },
        signal: AbortSignal.timeout(10_000),
      },
    );

    if (!res.ok) {
      console.warn(`Twitter API failed: ${res.status} ${res.statusText}`);
      return [];
    }

    const data = await res.json();
    const trends: XTrendV2[] = data.data ?? [];

    return trends.map((t) => ({
      type: 'social' as const,
      text: t.trend_name,
      url: `https://twitter.com/search?q=${encodeURIComponent(t.trend_name)}`,
      source: 'Twitter/X',
      publishedAt: new Date().toISOString(),
      entities: [],
    }));
  } catch (err) {
    console.warn('Twitter ingestion failed:', err);
    return [];
  }
}
