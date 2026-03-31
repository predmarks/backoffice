export const MAINNET_CHAIN_ID = 8453;
export const TESTNET_CHAIN_ID = 84532;

export function isTestnet(chainId: number): boolean {
  return chainId !== MAINNET_CHAIN_ID;
}

export function validateChainId(raw: unknown): number {
  return raw === TESTNET_CHAIN_ID ? TESTNET_CHAIN_ID : MAINNET_CHAIN_ID;
}

export function getBasescanUrl(chainId: number): string {
  return isTestnet(chainId) ? 'https://sepolia.basescan.org' : 'https://basescan.org';
}

export function getPredmarksUrl(chainId: number): string {
  return isTestnet(chainId) ? 'https://staging-app.predmarks.com' : 'https://predmarks.com';
}
