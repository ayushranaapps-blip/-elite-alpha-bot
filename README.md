# Elite Alpha Bot — Setup Guide

## What this does
- `/subscribe` — user gives their SOL address, bot tells them where to send payment, then auto-checks the blockchain every 2 minutes and grants the **Elite** role once payment lands.
- `/referral` — gives each user a code; anyone who subscribes with that code earns the referrer $10 (tracked in Supabase, you pay out manually for now).
- Daily check removes the Elite role automatically 30 days after payment if not renewed.
- Posts alerts (payment confirmed, referral credited, subscription expired) to a channel you choose.

## 1. Get 4 missing IDs from Discord
1. Go to discord.com/developers/applications → your app → **General Information** → copy **Application ID** → this is `DISCORD_CLIENT_ID`.
2. In Discord itself: enable Developer Mode (User Settings → Advanced → Developer Mode).
3. Right-click your server icon → **Copy Server ID** → this is `GUILD_ID`.
4. Right-click (or create) the role you want to grant → **Copy Role ID** → this is `ELITE_ROLE_ID`.
5. Right-click the channel where you want alerts posted → **Copy Channel ID** → this is `ALERT_CHANNEL_ID`.
6. In the Bot tab, under **Privileged Gateway Intents**, turn ON **Server Members Intent**.
7. Invite the bot to your server: go to **OAuth2 → URL Generator**, check `bot` and `applications.commands` scopes, permissions `Manage Roles` + `Send Messages`, open the generated URL and add it to Cryptoarea. Make sure the bot's role is positioned ABOVE the Elite role in Server Settings → Roles, or it won't be able to assign it.

## 2. Set up the database
1. In Supabase, open **SQL Editor** → paste the contents of `schema.sql` → Run.

## 3. Deploy on Render
1. Push this folder to a new GitHub repo (or ask me and I'll walk you through the git commands).
2. On Render: **New +** → **Background Worker** (not Web Service — this bot has no website, it just runs) → connect your repo.
3. Build command: `npm install`
4. Start command: `npm start`
5. Under **Environment**, add every variable from `.env.example`, filled in with your real values (Discord token, client ID, guild ID, role ID, channel ID, Supabase URL + secret key, Helius key, your receiving wallet).
6. Deploy. Check the logs for "Logged in as ..." to confirm it's live.

## 4. Register the slash commands (one-time)
Render's shell tab → run:
```
npm run register
```
This makes `/subscribe` and `/referral` show up in Discord. Re-run only if you change the commands later.

## Notes / assumptions
- First payment from a user = entry fee ($65); every payment after that = monthly fee ($60).
- SOL amount required is calculated live from the SOL/USD price at payment time, with 5% tolerance for price movement.
- Referral payouts are tracked as a running balance in Supabase — you pay affiliates manually (in SOL) whenever they cash out; nothing auto-sends money.
