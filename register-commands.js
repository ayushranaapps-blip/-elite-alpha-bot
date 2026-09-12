import { REST, Routes, SlashCommandBuilder } from 'discord.js';
import { config } from './lib/config.js';

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
].map(c => c.toJSON());

const rest = new REST({ version: '10' }).setToken(config.discordToken);

try {
  await rest.put(
    Routes.applicationGuildCommands(config.clientId, config.guildId),
    { body: commands }
  );
  console.log('Slash commands registered.');
} catch (err) {
  console.error(err);
}
