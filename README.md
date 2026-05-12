# Suds — Pressure Washing Business Manager

All-in-one CRM, scheduling, estimating, invoicing, accounting, chemical inventory,
satellite measurement, and marketing for pressure washing companies. Built with
Next.js 14 (App Router), Supabase, Tailwind, and optional integrations with
Stripe, Resend, Google Drive, and Google Maps.

## Quick start

```bash
cp .env.local.example .env.local
# fill in keys you want enabled (Stripe, Resend, Google, Maps)
npm install
npm run dev
```

Open http://localhost:3000 and create an account. Supabase is already provisioned
(connection in `.env.local`) — a fresh org, default services, expense categories,
and lead sources are seeded on signup.

## Features

### Money path
- Customers + properties (multi-property per account)
- Estimates with line items, 30-day expiry, deposit thresholds, internal duration + buffer
- **Digital approval** — every estimate gets a public `/quote/<token>` link the customer can approve or decline
- Convert estimate → invoice → payment → "PAID" receipt email
- Stripe payment links (auto-record paid via webhook)
- Manual payment recording (cash / check / card / ACH)
- Print-friendly invoice + estimate HTML at `/api/documents/...`

### Field operations
- Jobs with status (scheduled → in progress → completed) and per-job photos
- Calendar week view (drag-and-drop not yet — clicking goes to job detail)
- Appointment reminders auto-scheduled when a job is booked
- Before/after photo gallery generator — public token URL
- Photo annotations (schema-ready; UI TODO)

### Pricing
- Service catalog with per-unit pricing (flat / sqft / linear ft / hour / each)
- Per-service material modifiers (concrete vs brick vs wood…) and height multipliers
- Minimum charge per service AND a global minimum job total
- Deposit threshold (e.g. "deposit required above $1,000")
- Suggested add-ons (mark a service as add-on)

### Inventory
- Chemicals with current stock, reorder levels, SDS URL, hazard class
- Chemical purchase / usage / waste / adjustment transactions
- Mix calculator for SH ratios and surfactant
- Equipment tracking with service schedules

### Accounting
- Income from payments (auto)
- Expense logging with categories, vendors, deductible flag, optional receipt URL
- Live P&L for any period (month / last / quarter / YTD / last 12 months)
- 6-month revenue vs expense bar chart
- Vendor breakdown, payment method mix

### Marketing
- Lead pipeline (new → contacted → quoted → won/lost)
- Campaign tracker with budget, spend, impressions, clicks, conversions
- Lead sources (Google, FB, referral, yard sign…)
- Auto review request after invoice paid; 1–3 stars routed internally, 4–5 stars to Google

### Measurement
- Satellite polygon measurement tool at `/measure`
- Tag each polygon with material + service
- Attach to a property for re-use
- Measurements auto-set property GPS for future jobs

### Reminders
- Per-job appointment reminder (default: 24h lead)
- Per-customer recurring service reminder (default: 12 months)
- POST `/api/cron/reminders` (with `CRON_SECRET`) sends due ones

### Documents + Drive
- "View / Print" generates clean HTML invoices/estimates
- "Save to Drive" uploads to organization's connected Google Drive folder
- "Email to customer" sends the document via Resend

### Settings
- Business info (name, address, phone, email, tax rate, currency)
- Numbering prefixes for invoices and estimates
- Connect/disconnect Google Drive (OAuth2 refresh tokens stored per org)
- Integration status indicators (Stripe / Resend / Maps / Drive)

## Architecture

- **Next.js 14 App Router** with React Server Components + Server Actions
- **Supabase** for auth, Postgres, RLS, and storage
- **Row-Level Security** scopes all queries to the user's organization
- **Public flows** (quote, gallery, review) use scoped `anon` policies with random tokens
- **Tailwind + custom design tokens** for mobile + desktop
- **Stripe** payment links + webhook auto-recording
- **Resend** for transactional email (receipts, review requests, reminders)
- **Google Maps** (Drawing, Geometry, Places, Geocoding) for satellite measurement
- **Google Drive** OAuth2 + multipart upload for document storage

## Database

All tables enforce RLS via the `is_org_member(org_id)` function. Sign-up triggers
`handle_new_user()` which creates a profile + organization + default services /
categories / lead sources. Public read/update on quote, gallery, and review
tables is scoped by random token.

## Required environment variables

| Variable | Required for |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | All |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | All |
| `NEXT_PUBLIC_APP_URL` | Public links, OAuth redirects |
| `STRIPE_SECRET_KEY` | Stripe payment links |
| `STRIPE_WEBHOOK_SECRET` | Stripe auto-payment recording |
| `RESEND_API_KEY` + `RESEND_FROM` | Email receipts, reminders, review requests |
| `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` | Google Drive integration |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Satellite measurement tool |
| `CRON_SECRET` | Securing the reminders cron endpoint |

The app degrades gracefully — features without keys show clear "not configured"
hints in Settings → Integrations.

## Deployment

Deploy to Vercel:

```bash
vercel
```

Set env vars in the Vercel project. Configure the Stripe webhook to point to
`https://<your-app>/api/stripe/webhook`. Configure a Vercel cron to POST
`/api/cron/reminders` every few hours.

## Scripts

- `npm run dev` — local dev server
- `npm run build` — production build
- `npm run typecheck` — TypeScript check (no emit)
- `npm run lint` — ESLint

## Project layout

```
src/
  app/
    (auth)/login, signup
    (app)/<module>/page.tsx          ← authed routes
    quote/[token]                    ← public quote approval
    gallery/[token]                  ← public before/after gallery
    review/[token]                   ← public review request
    api/{stripe,google,documents,cron}
  components/                        ← UI primitives + map + photo uploader
  lib/{supabase,stripe,email,google-drive,document-html,org,utils}
```
