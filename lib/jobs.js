import { config } from './config.js';
import { getRecentTransfers } from './helius.js';
import { getSolUsdPrice } from './price.js';
import {
  getPendingPayments,
  markPaymentConfirmed,
  upsertMember,
  getExpiredMembers,
  markMemberExpired,
  creditReferral
} from './db.js';

// Checks every pending payment against real on-chain transfers, and grants the Elite role on a match.
export async function checkPendingPayments(client) {
  const pending = await getPendingPayments();
  if (pending.length === 0) return;

  const [transfers, solPrice] = await Promise.all([getRecentTransfers(), getSolUsdPrice()]);
  const guild = await client.guilds.fetch(config.guildId);
  const alertChannel = await client.channels.fetch(config.alertChannelId).catch(() => null);

  for (const payment of pending) {
    const expectedSol = payment.expected_usd / solPrice;
    const minSol = expectedSol * (1 - config.priceTolerance);

    const match = transfers.find(t =>
      t.from === payment.sol_address &&
      t.amountSol >= minSol &&
      new Date(t.timestamp * 1000) > new Date(payment.created_at)
    );
    if (!match) continue;

    await markPaymentConfirmed(payment.id, match.signature);

    const expiresAt = new Date(Date.now() + config.subscriptionDays * 24 * 60 * 60 * 1000).toISOString();
    await upsertMember(payment.discord_id, expiresAt);

    const member = await guild.members.fetch(payment.discord_id).catch(() => null);
    if (member) await member.roles.add(config.eliteRoleId).catch(console.error);

    let referralNote = '';
    if (payment.referral_code) {
      const referrerId = await creditReferral(payment.referral_code, config.referralPayoutUsd);
      if (referrerId) referralNote = ` | Referral credited to <@${referrerId}> (+$${config.referralPayoutUsd})`;
    }

    if (alertChannel) {
      alertChannel.send(
        `✅ Payment confirmed for <@${payment.discord_id}> — ${payment.type} (${match.amountSol.toFixed(3)} SOL). Elite role granted.${referralNote}`
      );
    }
  }
}

// Runs daily: removes the Elite role from anyone whose 30 days are up.
export async function checkExpiredMembers(client) {
  const expired = await getExpiredMembers();
  if (expired.length === 0) return;

  const guild = await client.guilds.fetch(config.guildId);
  const alertChannel = await client.channels.fetch(config.alertChannelId).catch(() => null);

  for (const m of expired) {
    await markMemberExpired(m.discord_id);
    const member = await guild.members.fetch(m.discord_id).catch(() => null);
    if (member) {
      await member.roles.remove(config.eliteRoleId).catch(console.error);
      member.send('Your Elite subscription has expired. Run /subscribe to renew and keep your access.').catch(() => {});
    }
    if (alertChannel) alertChannel.send(`⏳ Elite access expired and removed for <@${m.discord_id}>.`);
  }
}
