export interface OnchainMarket {
  id: string;
  onchainId: string;
  name: string;
  category: string;
  startTimestamp: number;
  endTimestamp: number;
  resolvedTo: number;
  volume: string;
  participants: number;
}

// Subgraph returns numeric fields as strings — coerce after fetch
type RawOnchainMarket = {
  [K in keyof OnchainMarket]: OnchainMarket[K] extends number ? string | number : OnchainMarket[K];
};

function coerceMarket(raw: RawOnchainMarket): OnchainMarket {
  return {
    ...raw,
    startTimestamp: Number(raw.startTimestamp),
    endTimestamp: Number(raw.endTimestamp),
    resolvedTo: Number(raw.resolvedTo),
    participants: Number(raw.participants),
  };
}

const PAGE_SIZE = 100;

const MARKET_LIST_QUERY = `
  query MarketList(
    $limit: Int!
    $skip: Int!
    $where: Market_filter
    $orderBy: Market_orderBy!
    $orderDirection: OrderDirection!
  ) {
    markets(
      first: $limit
      skip: $skip
      orderBy: $orderBy
      orderDirection: $orderDirection
      where: $where
    ) {
      id
      onchainId
      name
      category
      startTimestamp
      endTimestamp
      resolvedTo
      volume
      participants
    }
  }
`;

interface IndexerResponse<T> {
  data: T;
  errors?: { message: string }[];
}

async function queryIndexer<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const url = process.env.INDEXER_URL;
  if (!url) throw new Error('INDEXER_URL is not set');

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  const apiKey = process.env.INDEXER_API_KEY;
  if (apiKey) {
    const headerName = process.env.INDEXER_AUTH_HEADER ?? 'Authorization';
    const prefix = process.env.INDEXER_AUTH_PREFIX ?? 'Bearer';
    headers[headerName] = `${prefix} ${apiKey}`;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    throw new Error(`Indexer request failed: ${res.status} ${res.statusText}`);
  }

  const json = (await res.json()) as IndexerResponse<T>;

  if (json.errors?.length) {
    throw new Error(`Indexer GraphQL error: ${json.errors[0].message}`);
  }

  return json.data;
}

interface FetchMarketsOptions {
  where?: Record<string, unknown>;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
}

export async function fetchOnchainMarkets(options?: FetchMarketsOptions): Promise<OnchainMarket[]> {
  const all: OnchainMarket[] = [];
  let skip = 0;

  const variables = {
    limit: PAGE_SIZE,
    skip: 0,
    where: options?.where ?? {},
    orderBy: options?.orderBy ?? 'startTimestamp',
    orderDirection: options?.orderDirection ?? 'desc',
  };

  while (true) {
    variables.skip = skip;
    const { markets } = await queryIndexer<{ markets: RawOnchainMarket[] }>(MARKET_LIST_QUERY, variables);
    all.push(...markets.map(coerceMarket));
    if (markets.length < PAGE_SIZE) break;
    skip += PAGE_SIZE;
  }

  return all;
}

export async function fetchOpenOnchainMarkets(): Promise<OnchainMarket[]> {
  const markets = await fetchOnchainMarkets({
    where: { resolvedTo: 0 },
    orderBy: 'endTimestamp',
    orderDirection: 'asc',
  });

  const now = Math.floor(Date.now() / 1000);
  return markets.filter((m) => {
    if (m.startTimestamp && now < m.startTimestamp) return false;
    if (m.endTimestamp && now > m.endTimestamp) return false;
    return true;
  });
}

export async function fetchUnresolvedOnchainMarkets(): Promise<OnchainMarket[]> {
  return fetchOnchainMarkets({
    where: { resolvedTo: 0 },
    orderBy: 'endTimestamp',
    orderDirection: 'asc',
  });
}
