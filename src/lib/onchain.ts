import { createPublicClient, http, parseAbi } from 'viem';

const PRECOG_MASTER_ABI = parseAbi([
  'function markets(uint256 marketId) view returns (string name, string description, string category, string outcomes, uint256 startTimestamp, uint256 endTimestamp, address creator, address market)',
]);

export interface OnchainMarketData {
  name: string;
  description: string;
  category: string;
  outcomes: string[];
  startTimestamp: number;
  endTimestamp: number;
  creator: string;
  marketAddress: string;
}

function getClient() {
  const rpcUrl = process.env.PREDMARKS_RPC_URL;
  if (!rpcUrl) throw new Error('PREDMARKS_RPC_URL is not set');
  return createPublicClient({ transport: http(rpcUrl) });
}

function getMasterAddress(): `0x${string}` {
  const addr = process.env.PREDMARKS_MASTER_ADDRESS;
  if (!addr) throw new Error('PREDMARKS_MASTER_ADDRESS is not set');
  return addr as `0x${string}`;
}

function parseOutcomes(raw: string): string[] {
  // Try JSON array first, then comma-separated
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch { /* not JSON */ }
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

export async function fetchOnchainMarketData(onchainId: number): Promise<OnchainMarketData> {
  const client = getClient();
  const result = await client.readContract({
    address: getMasterAddress(),
    abi: PRECOG_MASTER_ABI,
    functionName: 'markets',
    args: [BigInt(onchainId)],
  });

  const [name, description, category, outcomesRaw, startTimestamp, endTimestamp, creator, marketAddress] = result;

  return {
    name,
    description,
    category,
    outcomes: parseOutcomes(outcomesRaw),
    startTimestamp: Number(startTimestamp),
    endTimestamp: Number(endTimestamp),
    creator,
    marketAddress,
  };
}

export async function fetchOnchainMarketDataBatch(onchainIds: number[]): Promise<Map<number, OnchainMarketData>> {
  const results = new Map<number, OnchainMarketData>();

  // Fetch in parallel, batches of 10
  for (let i = 0; i < onchainIds.length; i += 10) {
    const batch = onchainIds.slice(i, i + 10);
    const fetched = await Promise.allSettled(
      batch.map((id) => fetchOnchainMarketData(id)),
    );
    for (let j = 0; j < batch.length; j++) {
      const result = fetched[j];
      if (result.status === 'fulfilled') {
        results.set(batch[j], result.value);
      } else {
        console.warn(`Failed to fetch onchain data for market ${batch[j]}:`, result.reason);
      }
    }
  }

  return results;
}
