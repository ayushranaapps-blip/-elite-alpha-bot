import 'dotenv/config';

export const config = {
  discordToken: process.env.DISCORD_TOKEN,
  clientId: process.env.DISCORD_CLIENT_ID,
  guildId: process.env.GUILD_ID,
  eliteRoleId: process.env.ELITE_ROLE_ID,
  alertChannelId: process.env.ALERT_CHANNEL_ID,

  supabaseUrl: process.env.SUPABASE_URL,
  supabaseKey: process.env.SUPABASE_SECRET_KEY,

  heliusApiKey: process.env.HELIUS_API_KEY,
  receivingWallet: process.env.RECEIVING_WALLET,

  entryFeeUsd: parseFloat(process.env.ENTRY_FEE_USD || '65'),
  monthlyFeeUsd: parseFloat(process.env.MONTHLY_FEE_USD || '60'),
  referralPayoutUsd: parseFloat(process.env.REFERRAL_PAYOUT_USD || '10'),
  priceTolerance: 0.05, // allow 5% slippage on SOL/USD price swings between quote and payment
  subscriptionDays: 30
};
