create table pending_payments (
  id uuid primary key default gen_random_uuid(),
  discord_id text not null,
  sol_address text not null,
  type text not null, -- 'entry' or 'renewal'
  expected_usd numeric not null,
  referral_code text,
  status text not null default 'pending', -- pending | confirmed
  tx_signature text,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);

create table elite_members (
  discord_id text primary key,
  expires_at timestamptz not null,
  status text not null default 'active' -- active | expired
);

create table referrals (
  discord_id text primary key,
  code text unique not null,
  balance_usd numeric not null default 0
);
