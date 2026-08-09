# Go-live checklist & leftovers

Last updated: 2026-08-10

This file tracks **what is already shipped in code** vs **what still needs manual production setup** before notifications and related migrations are fully live.

---

## Done in code (this release)

- Product PDP **Chat with Seller** (WhatsApp deep link, store WhatsApp number, current variant message)
- Store field `whatsapp_number` (Admin → Settings)
- Owner order alerts orchestrator: **email (Resend)** + **WhatsApp (CallMeBot)** + **browser push**
- Hooks: checkout `placeOrder` → `order_created`; Razorpay verify → `payment_confirmed`
- Admin **Order notifications** card (enable browser push on a device)
- Laptop variant fields helpers + catalog scraper improvements
- Service worker `public/sw.js` for push

---

## Still to do manually (not blocked on more coding)

### A. Supabase SQL (run on **production** project in SQL editor)

Apply if not already applied (safe / idempotent `IF NOT EXISTS` style):

1. `supabase/migrations/APPLY_NOW_store_whatsapp_number.sql`
2. `supabase/migrations/APPLY_NOW_push_subscriptions.sql`
3. `supabase/migrations/APPLY_NOW_laptop_variant_fields.sql` (if selling laptops with CPU/display axes)
4. Any other pending `APPLY_NOW_*.sql` you haven’t run yet (`store_categories_full`, `master_catalog_rls`, indexes, etc.)

### B. Admin → Store Settings

- [ ] Public **email** (used for order alert emails when `ORDER_NOTIFY_TO_EMAIL` is unset)
- [ ] **WhatsApp number** for product chat + CallMeBot (digits with country code, e.g. `9198xxxxxxxx`)
- [ ] Confirm **phone**, address, GST invoice fields

### C. Order notification env (Vercel Production)

Copy keys from `docs/env.notifications.example`:

| Variable | Purpose |
|----------|---------|
| `RESEND_API_KEY` | Owner email alerts |
| `ORDER_NOTIFY_FROM_EMAIL` | Verified sender (use Resend domain) |
| `ORDER_NOTIFY_TO_EMAIL` | Optional override recipient |
| `CALLMEBOT_API_KEY` | WhatsApp pings to owner phone |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Browser push |
| `VAPID_PRIVATE_KEY` | Browser push |
| `VAPID_SUBJECT` | e.g. `mailto:you@domain.com` |

Generate VAPID once:

```bash
npx web-push generate-vapid-keys
```

CallMeBot: message `+34 644 51 95 23` from the **owner WhatsApp** with  
`I allow callmebot to send me messages` → paste the API key into `CALLMEBOT_API_KEY`.

Then in Admin Settings (on the owner’s phone browser): **Enable alerts on this device**.

### D. Site / payments / storage (verify on Vercel)

- [ ] `NEXT_PUBLIC_SITE_URL` = real production domain (no localhost; used in WhatsApp product links + emails)
- [ ] Supabase URL + anon + service role for the **prod** project
- [ ] Razorpay live keys (or keep demo only if intentionally testing)
- [ ] Cloudflare R2 env vars for images / store profile JSON

### E. Smoke after deploy

```bash
npm run smoke -- https://YOUR_PRODUCTION_DOMAIN
```

Manual happy paths:

1. Storefront home → category → product → change variant → Chat with Seller opens correct chat  
2. Add to bag → checkout COD → order appears in Admin → Orders  
3. Online pay demo/live → order paid/confirmed  
4. Admin POS walk-in (optional)  
5. Admin Settings save branding  

---

## Intentionally deferred

- Full WhatsApp **Business Cloud API** (official templates) — CallMeBot is the interim personal ping  
- Automated customer confirmation emails (owner alerts only for now)  
- Multi-vendor seller WhatsApp per product (single store today)

---

## Do not commit

- `.env.local`, API keys, VAPID private keys  
- One-off debug scripts / scrape dumps at repo root (`test_*.js`, `apple_raw.html`, etc.)
