# mobile-store

Mahadev Mobiles — Next.js storefront, admin, POS, and GST-ready invoicing.

## Stack

- Next.js + Supabase (auth/DB)
- Cloudflare R2 (product images & store profile)
- Deploy target: Vercel

## Local

```bash
npm install
cp .env.local.example .env.local   # if present; otherwise create .env.local
npm run dev
```

Never commit `.env.local`.

## Database

Apply SQL in Supabase in order: `supabase/schema.sql` (or `complete_schema.sql`), then files under `supabase/migrations/`.

## Go-live / leftovers

See **[docs/GO_LIVE.md](./docs/GO_LIVE.md)** for:
- Order notification setup (email / WhatsApp / browser push)
- SQL migrations still to apply on production
- Post-deploy smoke checklist

## Smoke test

```bash
npm run smoke                         # localhost:3000
npm run smoke -- https://your.domain  # production
```
