# Giveaways — setup & QA

## 1. Run migration

In Supabase SQL Editor (prod + any staging):

`supabase/migrations/APPLY_NOW_giveaways.sql`

Safe to re-run. Creates campaigns, rules, participants, immutable entry ledger, risk flags, audit log, draws, winners.

## 2. Admin

1. Open **Admin → Giveaways**
2. Create a campaign (default rules: Join +1, Share +1 / 24h, Referral +2, Purchase ₹20k/+5, ₹50k/+10)
3. Set status to **active**, set start/end window
4. Open public URL `/giveaway/{slug}`

## 3. Customer QA checklist

- [ ] Logged-out: tap **Enter Giveaway** → login/signup with email+password → return with `autojoin=1` → joined + JOIN entries
- [ ] Second tap Enter is idempotent (no double JOIN)
- [ ] Copy referral link; friend opens `?ref=CODE`, logs in, joins → referrer gets referral entries once
- [ ] Self-referral does not award
- [ ] Share & Invite → after share intent, share reward once per cooldown
- [ ] Qualifying **online** paid order (`payment_status=paid`, `user_id` set) awards purchase entries once
- [ ] Cancel / refund creates `refund_reversal` (negative), does not delete original purchase row
- [ ] Leaderboard shows safe display names only
- [ ] My entries / rank / entries-to-next update after awards
- [ ] Admin draw (status completed / ended) runs once; announce emails winner (needs `RESEND_API_KEY`)

## 4. Env

Uses existing:

- Supabase
- `RESEND_API_KEY` + `ORDER_NOTIFY_FROM_EMAIL` for winner email
- `NEXT_PUBLIC_SITE_URL` for referral links

## 5. Unit tests

```bash
npx tsx --test src/lib/giveaway/rules.test.ts
```

## 6. Local E2E against DEV Supabase

With `npm run dev` running and `.env.local` pointing at DEV (not prod):

```bash
node --env-file=.env.local scripts/e2e_giveaway.mjs
```

This seeds two dummy customers + an active campaign, verifies join/referral/share/purchase/refund/draw uniqueness, and smokes public HTTP routes.