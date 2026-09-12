import { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder } from 'discord.js';
import cron from 'node-cron';
import http from 'http';
import { config } from './lib/config.js';
import { createPendingPayment, getOrCreateReferralCode, supabase } from './lib/db.js';
import { checkPendingPayments, checkExpiredMembers } from './lib/jobs.js';
import { postTrendingCoins, postNewLaunches } from './lib/marketAlerts.js';
import { getTrendingSolanaTokens, getNewSolanaLaunches, getTokenDetails } from './lib/dexscreener.js';

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

    if (pool.length === 0) {
      await interaction.editReply('No coins available right now, try again in a bit.');
      return;
    }

    const pick = pool[Math.floor(Math.random() * pool.length)];
    const details = await getTokenDetails(pick.tokenAddress).catch(() => null);

    const symbol = details?.baseToken?.symbol || pick.tokenAddress.slice(0, 6);
    const price = details?.priceUsd ? `$${Number(details.priceUsd).toFixed(6)}` : 'n/a';
    const change = details?.priceChange?.h24 != null ? `${details.priceChange.h24}%` : 'n/a';
    const link = details?.url || `https://dexscreener.com/solana/${pick.tokenAddress}`;

    await interaction.editReply(
      `🎲 **${symbol}**\nPrice: ${price} | 24h: ${change}\n${link}\n\n_Not financial advice — always DYOR before buying._`
    );
  }
});

client.login(config.discordToken);
