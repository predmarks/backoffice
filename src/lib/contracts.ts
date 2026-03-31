export const PRECOG_MASTER_ABI = [
  // Read
  {
    name: 'markets',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'marketId', type: 'uint256' }],
    outputs: [
      { name: 'name', type: 'string' },
      { name: 'description', type: 'string' },
      { name: 'category', type: 'string' },
      { name: 'outcomes', type: 'string' },
      { name: 'startTimestamp', type: 'uint256' },
      { name: 'endTimestamp', type: 'uint256' },
      { name: 'creator', type: 'address' },
      { name: 'market', type: 'address' },
    ],
  },
  {
    name: 'ADMIN_ROLE',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'bytes32' }],
  },
  {
    name: 'hasRole',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'role', type: 'bytes32' },
      { name: 'account', type: 'address' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  // Write
  {
    name: 'updateMarket',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'marketId', type: 'uint256' },
      { name: 'name', type: 'string' },
      { name: 'description', type: 'string' },
      { name: 'category', type: 'string' },
      { name: 'outcomes', type: 'string[]' },
      { name: 'startTimestamp', type: 'uint256' },
      { name: 'endTimestamp', type: 'uint256' },
      { name: 'marketCreator', type: 'address' },
      { name: 'marketOracle', type: 'address' },
    ],
    outputs: [],
  },
] as const;

export const PRECOG_MARKET_ABI = [
  {
    name: 'reportResult',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'marketId', type: 'uint256' },
      { name: 'outcome', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'result',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'oracle',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
] as const;

export const REPORTER_ABI = [
  {
    name: 'reportResult',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'market', type: 'address' },
      { name: 'marketId', type: 'uint256' },
      { name: 'outcome', type: 'uint256' },
    ],
    outputs: [],
  },
] as const;

export const REPORTER_ADDRESSES: Record<number, `0x${string}` | null> = {
  8453: (process.env.NEXT_PUBLIC_REPORTER_ADDRESS_BASE ?? null) as `0x${string}` | null,
  84532: (process.env.NEXT_PUBLIC_REPORTER_ADDRESS_SEPOLIA ?? null) as `0x${string}` | null,
};

// Master contract addresses per chain
export const MASTER_ADDRESSES: Record<number, `0x${string}`> = {
  8453: (process.env.NEXT_PUBLIC_MASTER_ADDRESS_BASE ??
    '0x2297b780508cf997aaff9ad28254006e131599e5') as `0x${string}`,
  84532: (process.env.NEXT_PUBLIC_MASTER_ADDRESS_SEPOLIA ??
    '0x0000000000000000000000000000000000000000') as `0x${string}`,
};
