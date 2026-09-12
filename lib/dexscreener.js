// Free, no API key required.
const BASE = 'https://api.dexscreener.com';

// Top boosted/trending Solana tokens right now
export async function getTrendingSolanaTokens() {
  const res = await fetch(`${BASE}/token-boosts/top/v1`);
  const data = await res.json();
  return (Array.isArray(data) ? data : [])
    .filter(t => t.chainId === 'solana')
    .slice(0, 5);
}

// Freshly listed Solana token profiles (new launches)
export async function getNewSolanaLaunches() {
  const res = await fetch(`${BASE}/token-profiles/latest/v1`);
  const data = await res.json();
  return (Array.isArray(data) ? data : [])
    .filter(t => t.chainId === 'solana')
    .slice(0, 10);
}

// Pulls price + liquidity info for a given token address
export async function getTokenDetails(tokenAddress) {
  const res = await fetch(`${BASE}/tokens/v1/solana/${tokenAddress}`);
  const data = await res.json();
  return Array.isArray(data) ? data[0] : null;
}
// Basic rug-pull screen. Not foolproof — just filters out the most obvious red flags:
// very low liquidity (easy to dump), near-zero trading, or a pair that's minutes old.
export function passesRugFilter(details) {
  if (!details) return false;
  const liquidityUsd = details.liquidity?.usd || 0;
  const volume24h = details.volume?.h24 || 0;
  const ageMs = details.pairCreatedAt ? Date.now() - details.pairCreatedAt : 0;
  const twoHours = 2 * 60 * 60 * 1000;

  return liquidityUsd >= 5000 && volume24h >= 1000 && ageMs >= twoHours;
}
