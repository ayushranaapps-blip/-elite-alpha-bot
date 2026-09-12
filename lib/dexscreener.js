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
export function passesRugFilter(details) {
  return getRugCheckBreakdown(details).passed;
}

export function getRugCheckBreakdown(details) {
  if (!details) {
    return { passed: false, checks: [{ label: 'Token found', ok: false }] };
  }
  const liquidityUsd = details.liquidity?.usd || 0;
  const volume24h = details.volume?.h24 || 0;
  const ageMs = details.pairCreatedAt ? Date.now() - details.pairCreatedAt : 0;
  const twoHours = 2 * 60 * 60 * 1000;

  const checks = [
    { label: `Liquidity ≥ $5,000 (currently $${Math.round(liquidityUsd).toLocaleString()})`, ok: liquidityUsd >= 5000 },
    { label: `24h volume ≥ $1,000 (currently $${Math.round(volume24h).toLocaleString()})`, ok: volume24h >= 1000 },
    { label: `Pair age ≥ 2 hours (currently ${(ageMs / 3600000).toFixed(1)}h)`, ok: ageMs >= twoHours }
  ];

  return { passed: checks.every(c => c.ok), checks };
}
