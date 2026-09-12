import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';

export const supabase = createClient(config.supabaseUrl, config.supabaseKey);

export async function createPendingPayment({ discordId, solAddress, type, expectedUsd, referralCode }) {
  const { data, error } = await supabase
    .from('pending_payments')
    .insert({
      discord_id: discordId,
      sol_address: solAddress,
      type, // 'entry' or 'renewal'
      expected_usd: expectedUsd,
      referral_code: referralCode || null,
      status: 'pending'
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getPendingPayments() {
  const { data, error } = await supabase
    .from('pending_payments')
    .select('*')
    .eq('status', 'pending');
  if (error) throw error;
  return data;
}

export async function markPaymentConfirmed(id, signature) {
  const { error } = await supabase
    .from('pending_payments')
    .update({ status: 'confirmed', tx_signature: signature, confirmed_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function upsertMember(discordId, expiresAt) {
  const { error } = await supabase
    .from('elite_members')
    .upsert({ discord_id: discordId, expires_at: expiresAt, status: 'active' }, { onConflict: 'discord_id' });
  if (error) throw error;
}

export async function getExpiredMembers() {
  const { data, error } = await supabase
    .from('elite_members')
    .select('*')
    .eq('status', 'active')
    .lt('expires_at', new Date().toISOString());
  if (error) throw error;
  return data;
}

export async function markMemberExpired(discordId) {
  const { error } = await supabase
    .from('elite_members')
    .update({ status: 'expired' })
    .eq('discord_id', discordId);
  if (error) throw error;
}

export async function getOrCreateReferralCode(discordId) {
  const { data: existing } = await supabase
    .from('referrals')
    .select('*')
    .eq('discord_id', discordId)
    .maybeSingle();
  if (existing) return existing.code;

  const code = discordId.slice(-5) + Math.random().toString(36).slice(2, 5).toUpperCase();
  const { error } = await supabase
    .from('referrals')
    .insert({ discord_id: discordId, code });
  if (error) throw error;
  return code;
}

export async function creditReferral(code, amountUsd) {
  const { data: ref, error: findErr } = await supabase
    .from('referrals')
    .select('*')
    .eq('code', code)
    .maybeSingle();
  if (findErr || !ref) return null;

  const { error } = await supabase
    .from('referrals')
    .update({ balance_usd: (ref.balance_usd || 0) + amountUsd })
    .eq('code', code);
  if (error) throw error;
  export async function getMySubscription(discordId) {
  const { data, error } = await supabase
    .from('elite_members')
    .select('*')
    .eq('discord_id', discordId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getReferralLeaderboard(limit = 5) {
  const { data, error } = await supabase
    .from('referrals')
    .select('discord_id, balance_usd')
    .order('balance_usd', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}
  return ref.discord_id;
}
