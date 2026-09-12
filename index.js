import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from 'discord.js';
import cron from 'node-cron';
import http from 'http';
import { config } from './lib/config.js';
import { createPendingPayment, getOrCreateReferralCode, supabase, getMySubscription, getReferralLeaderboard } from './lib/db.js';
import { checkPendingPayments, checkExpiredMembers } from './lib/jobs.js';
import { postTrendingCoins, postNewLaunches } from './lib/marketAlerts.js';
import { getTrendingSolanaTokens, getNewSolanaLaunches, getTokenDetails, passesRugFilter, getRugCheckBreakdown } from './lib/dexscreener.js';

http.createServer((req, res) => res.end('Elite Alpha Bot is running')).listen(process.env.PORT || 3000);

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

async function registerCommands() {
  const commands = [
    new SlashCommandBuilder()
      .setName('subscribe')
      .setDescription('Pay for Elite access and get instant access once your SOL payment is confirmed')
      .addStringOption(opt =>
        opt.setName('sol_address')
          .setDescription('The Solana wallet address you will pay FROM')
          .setRequired(true))
      .addStringOption(opt =>
        opt.setName('referral_code')
          .setDescription('Referral code, if someone sent you here (optional)')
          .setRequired(false)),
    new SlashCommandBuilder()
      .setName('referral')
      .setDescription('Get your referral code and see how much you have earned'),
    new SlashCommandBuilder()
      .setName('giverandomcoin')
      .setDescription('Get a random trending or newly launched Solana memecoin'),
    new SlashCommandBuilder()
      .setName('price')
      .setDescription('Check the live price of a specific Solana token')
      .addStringOption(opt =>
        opt.setName('address')
          .setDescription('The token\'s contract address')
          .setRequired(true)),
    new SlashCommandBuilder()
      .setName('rugcheck')
      .setDescription('Run the rug-pull filter checks against a specific token')
      .addStringOption(opt =>
        opt.setName('address')
          .setDescription('The token\'s contract address')
          .setRequired(true)),
    new SlashCommandBuilder()
      .setName('mysubscription')
      .setDescription('Check your Elite subscription status and expiry date'),
    new SlashCommandBuilder()
      .setName('leaderboard')
      .setDescription('See the top referral earners'),
  ].map(c => c.toJSON());

  const rest = new REST({ version: '10' }).setToken(config.discordToken);
  await rest.put(
    Routes.applicationGuildCommands(config.clientId, config.guildId),
    { body: commands }
  );
  console.log('Slash commands registered.');
}

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);

  registerCommands().catch(console.error);

  cron.schedule('*/2 * * * *', () => checkPendingPayments(client).catch(console.error));
  cron.schedule('0 0 * * *', () => checkExpiredMembers(client).catch(console.error));
  cron.schedule('*/30 * * * *', () => postTrendingCoins(client).catch(console.error));
  cron.schedule('*/10 * * * *', () => postNewLaunches(client).catch(console.error));
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'subscribe') {
    const solAddress = interaction.options.getString('sol_address');
    const referralCode = interaction.options.getString('referral_code');

    const { data: existingMember } = await supabase
      .from('elite_members')
      .select('discord_id')
      .eq('discord_id', interaction.user.id)
      .maybeSingle();

    const type = existingMember ? 'renewal' : 'entry';
    const expectedUsd = existingMember ? config.monthlyFeeUsd : config.entryFeeUsd;

    await createPendingPayment({
      discordId: interaction.user.id,
      solAddress,
      type,
      expectedUsd,
      referralCode
    });

    await interaction.reply({
      content:
        `Send **$${expectedUsd} worth of SOL** to \`${config.receivingWallet}\` from \`${solAddress}\`.\n` +
        `Once it lands on-chain, this usually confirms within 2 minutes and your Elite role unlocks automatically.`,
      ephemeral: true
    });
  }

  if (interaction.commandName === 'referral') {
    const code = await getOrCreateReferralCode(interaction.user.id);
    const { data } = await supabase.from('referrals').select('balance_usd').eq('discord_id', interaction.user.id).single();

    await interaction.reply({
      content: `Your referral code: **${code}**\nShare it — people use it in \`/subscribe\`.\nBalance earned: **$${(data?.balance_usd || 0).toFixed(2)}**`,
      ephemeral: true
    });
  }

  if (interaction.commandName === 'giverandomcoin') {
    await interaction.deferReply();

    const [trending, launches] = await Promise.all([getTrendingSolanaTokens(), getNewSolanaLaunches()]);
    const pool = [...trending, ...launches];

    const withDetails = await Promise.all(
      pool.map(async p => ({ token: p, details: await getTokenDetails(p.tokenAddress).catch(() => null) }))
    );
    const safe = withDetails.filter(x => passesRugFilter(x.details));

    if (safe.length === 0) {
      await interaction.editReply('No coins passed the rug-pull filter right now (low liquidity/volume/too new) — try again later.');
      return;
    }

    const pick = safe[Math.floor(Math.random() * safe.length)];
    const details = pick.details;

    const symbol = details?.baseToken?.symbol || pick.token.tokenAddress.slice(0, 6);
    const price = details?.priceUsd ? `$${Number(details.priceUsd).toFixed(6)}` : 'n/a';
    const change = details?.priceChange?.h24 != null ? `${details.priceChange.h24}%` : 'n/a';
    const liquidity = details?.liquidity?.usd ? `$${Math.round(details.liquidity.usd).toLocaleString()}` : 'n/a';
    const link = details?.url || `https://dexscreener.com/solana/${pick.token.tokenAddress}`;

    await interaction.editReply(
      `🎲 **${symbol}**\nPrice: ${price} | 24h: ${change} | Liquidity: ${liquidity}\n${link}\n\n_Passed basic rug filters (liquidity/volume/age) — always DYOR, this is not financial advice._`
    );
  }

  if (interaction.commandName === 'price') {
    await interaction.deferReply();
    const address = interaction.options.getString('address');
    const details = await getTokenDetails(address).catch(() => null);

    if (!details) {
      await interaction.editReply('Could not find that token on Dexscreener — double check the address.');
      return;
    }

    const symbol = details.baseToken?.symbol || address.slice(0, 6);
    const price = details.priceUsd ? `$${Number(details.priceUsd).toFixed(6)}` : 'n/a';
    const change = details.priceChange?.h24 != null ? `${details.priceChange.h24}%` : 'n/a';
    const liquidity = details.liquidity?.usd ? `$${Math.round(details.liquidity.usd).toLocaleString()}` : 'n/a';
    const volume = details.volume?.h24 ? `$${Math.round(details.volume.h24).toLocaleString()}` : 'n/a';

    await interaction.editReply(
      `**${symbol}**\nPrice: ${price} | 24h change: ${change}\nLiquidity: ${liquidity} | 24h volume: ${volume}\n${details.url || ''}`
    );
  }

  if (interaction.commandName === 'rugcheck') {
    await interaction.deferReply();
    const address = interaction.options.getString('address');
    const details = await getTokenDetails(address).catch(() => null);
    const result = getRugCheckBreakdown(details);

    const lines = result.checks.map(c => `${c.ok ? '✅' : '❌'} ${c.label}`).join('\n');
    await interaction.editReply(
      `${result.passed ? '🟢 Passed basic rug filters' : '🔴 Failed one or more rug filters'}\n\n${lines}\n\n_This is a basic on-chain heuristic, not a guarantee — always DYOR._`
    );
  }

  if (interaction.commandName === 'mysubscription') {
    const sub = await getMySubscription(interaction.user.id);
    if (!sub) {
      await interaction.reply({ content: "You don't have an active Elite subscription. Use /subscribe to join.", ephemeral: true });
      return;
    }
    const expires = new Date(sub.expires_at).toLocaleDateString();
    await interaction.reply({
      content: `Status: **${sub.status}**\nExpires: **${expires}**`,
      ephemeral: true
    });
  }

  if (interaction.commandName === 'leaderboard') {
    const top = await getReferralLeaderboard(5);
    if (!top || top.length === 0) {
      await interaction.reply('No referrals yet — be the first with /referral!');
      return;
    }
    const lines = top.map((r, i) => `${i + 1}. <@${r.discord_id}> — $${Number(r.balance_usd).toFixed(2)}`).join('\n');
    await interaction.reply(`🏆 **Top Referral Earners**\n\n${lines}`);
  }
});

client.login(config.discordToken);
