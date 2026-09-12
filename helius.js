import { config } from './config.js';

// Pulls recent transactions for the receiving wallet and returns plain SOL transfers.
export async function getRecentTransfers() {
  const url = `https://api.helius.xyz/v0/addresses/${config.receivingWallet}/transactions?api-key=${config.heliusApiKey}&limit=50`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error('Helius fetch failed', res.status, await res.text());
    return [];
  }
  const txs = await res.json();

  const transfers = [];
  for (const tx of txs) {
    if (!tx.nativeTransfers) continue;
    for (const t of tx.nativeTransfers) {
      if (t.toUserAccount === config.receivingWallet) {
        transfers.push({
          signature: tx.signature,
          from: t.fromUserAccount,
          amountSol: t.amount / 1e9,
          timestamp: tx.timestamp // unix seconds
        });
      }
    }
  }
  return transfers;
}
