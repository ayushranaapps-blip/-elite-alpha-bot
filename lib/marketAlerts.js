import { config } from './config.js';
import { getTrendingSolanaTokens, getNewSolanaLaunches, getTokenDetails } from './dexscreener.js';
import { supabase } from './db.js';

export async function postTrendingCoins(client) {
  if (!config.trendingChannelId) return;
  const channel = await client.channels.fetch(config.trendingChannelId).catch(() => null);
  if (!channel) return;

  const boosts = await getTrendingSolanaTokens();
  if (boosts.length === 0) return;

  const lines = [];
  for (const b of boosts) {
    const details = await getTokenDetails(b.tokenAddress).catch(() => null);
    const symbol = details?.baseToken?.symbol || b.tokenAddress.slice(0, 6);
    const price = details?.priceUsd ? `$${Number(details.priceUsd).toFixed(6)}` : 'n/a';
    const change = details?.priceChange?.h24 != null ? `${details.priceChange.h24}%` : 'n/a';
    const link = details?.url || `https://dexscreener.com/solana/${b.tokenAddress}`;
    lines.push(`**${symbol}** — ${price} (24h: ${change})\n${link}`);
  }

  channel.send(`🔥 **Trending Solana tokens right now**\n\n${lines.join('\n\n')}`);
}

export async function postNewLaunches(client) {
  if (!config.coinLaunchesChannelId) return;
  const channel = await client.channels.fetch(config.coinLaunchesChannelId).catch(() => null);
  if (!channel) return;

  const launches = await getNewSolanaLaunches();
  for (const t of launches) {
    const { data: existing } = await supabase
      .from('posted_tokens')
      .select('token_address')
      .eq('token_address', t.tokenAddress)
      .maybeSingle();
    if (existing) continue;

    await supabase.from('posted_tokens').insert({ token_address: t.tokenAddress });

    const link = t.url || `https://dexscreener.com/solana/${t.tokenAddress}`;
    channel.send(`🚀 **New token listed:** ${t.header || t.tokenAddress}\n${t.description ? t.description.slice(0, 150) + '\n' : ''}${link}`);
  }
}
