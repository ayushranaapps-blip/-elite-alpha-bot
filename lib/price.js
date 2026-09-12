// Fetches the current SOL/USD price so we know how much SOL a $65 / $60 fee equals.
export async function getSolUsdPrice() {
  const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd');
  const data = await res.json();
  return data.solana.usd;
}
