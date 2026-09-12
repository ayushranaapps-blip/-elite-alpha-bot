import { Client, GatewayIntentBits } from 'discord.js';
import cron from 'node-cron';
import http from 'http';
import { config } from './lib/config.js';
import { createPendingPayment, getOrCreateReferralCode, supabase } from './lib/db.js';
import { checkPendingPayments, checkExpiredMembers } from './lib/jobs.js';

// Render's free tier only stays alive as a "Web Service" that responds to pings.
// This tiny server does nothing except say "OK" so an uptime pinger can keep the bot awake.
http.createServer((req, res) => res.end('Elite Alpha Bot is running')).listen(process.env.PORT || 3000);

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);

  // Check for new payments every 2 minutes
  cron.schedule('*/2 * * * *', () => checkPendingPayments(client).catch(console.error));
  // Check for expired subscriptions once a day
  cron.schedule('0 0 * * *', () => checkExpiredMembers(client).catch(console.error));
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'subscribe') {
    const solAddress = interaction.options.getString('sol_address');
    const referralCode = interaction.options.getString('referral_code');

    // First-time payer pays the entry fee, everyone after that pays the monthly fee
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
});

client.login(config.discordToken);
