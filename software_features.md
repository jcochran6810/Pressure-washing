# Suds — Software Features Reference

**Suds** is an all-in-one business management application for pressure washing
companies, built with Next.js 14 (App Router), Supabase, and Tailwind. It bundles
CRM, scheduling, estimating, invoicing, accounting, chemical inventory, satellite
measurement, and marketing into a single web app that works on phone or laptop.

---

## A note on software tiers / pricing

**The Suds codebase does not implement a tiered subscription model for the
software itself.** There is a single landing page (`src/app/page.tsx`) with a
"Start free" CTA, sign-up creates one organization with the full feature set,
and there is no billing/subscription/plan table in the database, no Stripe
checkout for subscription tiers, and no feature-gating by plan. Every signed-up
org gets every feature listed below.

The Stripe integration that **is** present is only for the pressure washing
company to collect payments from *their own customers* via payment links — not
for billing Suds users.

The word "Pricing" inside the app refers to **how the pressure washing company
prices the services they sell to their customers** (per-sqft, per-linear-ft,
material modifiers, deposit thresholds, minimum job total). Those are configured
per organization under **Services & Pricing** and **Global pricing rules**.
There are no fixed dollar amounts shipped — each operator sets their own rates.

If you are looking for SaaS plan pricing to publish externally, that does not
exist in the repo and would need to be designed and added (likely as a
`subscription_plans` table, a billing route, and feature flags scoped by plan).

---

## Feature inventory

### Money path — quote → invoice → paid
- **Customers + properties** — CRM with multi-property per account
- **Estimates** with line items, 30-day expiry, deposit thresholds, internal
  duration + buffer
- **Digital estimate approval** — every estimate gets a public `/quote/<token>`
  link the customer can approve or decline
- **Estimate → invoice → payment → receipt** conversion flow
- **Stripe payment links** auto-created per invoice; payment auto-recorded via
  webhook (`/api/stripe/webhook`)
- **Manual payment recording** (cash / check / card / ACH)
- **Print-friendly HTML** invoices and estimates at `/api/documents/...`
- **Receipt email** sent on "PAID"

### Field operations
- **Jobs** with status (scheduled → in progress → completed) and per-job photos
- **Drag-and-drop calendar** — grab a job card and drop it on a new day to
  reschedule; time-of-day preserved; appointment reminders recreated automatically
- **Appointment reminders** auto-scheduled when a job is booked (default 24 h
  lead)
- **Before/after photo galleries** with a public token URL
- **Photo annotations** — built-in canvas editor for arrows, boxes, circles,
  freehand, text; annotated render uploaded back to storage and used in
  galleries / receipts
- **Contracts & recurring scheduling** — monthly / quarterly / annual service
  plans that auto-draft estimates (and optionally jobs) on schedule
  (`/api/cron/contracts`)

### Services & pricing (service catalog configuration)
- **Service catalog** with selectable pricing unit: flat / per sqft / per
  linear ft / per hour / each
- **Per-service material modifiers** — multipliers for concrete, brick, stucco,
  vinyl, wood, composite, roof shingle, roof tile, pavers (e.g. 1.2 = +20 %)
- **Height modifier per story** (default 0.15 = +15 % per story)
- **Per-service minimum charge** and a **global minimum job total**
- **Deposit threshold** (e.g. require deposit when estimate exceeds $X) plus a
  configurable **deposit percentage** (default 0.25 = 25 %)
- **Add-on services** — mark a service as a suggested add-on
- **Default duration** per service for scheduling

### Inventory
- **Chemicals** with current stock, reorder levels, SDS URL, hazard class
- **Chemical transactions** — purchase / usage / waste / adjustment
- **Mix calculator** for SH ratios and surfactant
- **Equipment tracking** with serial numbers, purchase price, current value,
  hours used, next service date

### Accounting & sync
- **Income** auto-calculated from recorded payments
- **Expense logging** with categories, vendors, deductible flag, optional
  receipt URL
- **Live P&L** for any period (month / last month / quarter / YTD / last 12 mo)
- **6-month revenue vs expense** bar chart
- **Vendor breakdown** and **payment method mix**
- **CSV exports** of invoices, payments, expenses, customers — importable into
  QuickBooks, Xero, Wave, FreshBooks
- **QuickBooks Online live sync** via OAuth — push customers + invoices
  directly to a QBO company (see `/accounting`)

### Marketing
- **Lead pipeline** (new → contacted → quoted → won/lost)
- **Campaign tracker** with budget, spend, impressions, clicks, conversions
- **Lead sources** (Google, FB, referral, yard sign, etc.)
- **Auto review request** after invoice paid — 1–3 stars routed internally,
  4–5 stars routed to Google

### Measurement
- **Satellite polygon measurement tool** at `/measure` (Google Maps Drawing,
  Geometry, Places, Geocoding)
- Tag each polygon with material + service
- Attach measurement to a property for re-use
- Measurements auto-set property GPS for future jobs

### Reminders & messaging
- **Per-job appointment reminder** (default 24 h lead)
- **Per-customer recurring service reminder** (default 12 months)
- Cron endpoints: `POST /api/cron/reminders` and `POST /api/cron/contracts`
  (secured by `CRON_SECRET`)
- **Pre-made email + SMS templates** — estimate-send, invoice-send, receipt,
  payment reminder, appointment reminder, review request, contract renewal,
  waiver request — customisable per org
- **Telnyx SMS** — invoices, estimates, receipts, reminders, waiver links can
  all be sent via SMS in addition to email; every send logged in `sms_log`

### Waivers & signed documents
- Author one or more **liability waivers** per org (version + active flag)
- Send via email or SMS — customer signs in-app with a touch / mouse
  signature pad
- **Audit trail**: IP, user agent, timestamp, signed text, signature image
  stored in Supabase storage
- Public sign URL at `/waiver/<token>`; signed waivers appear under customer
  service history

### Customer service history
- `/customers/<id>/history` aggregates every estimate, job, invoice, payment,
  photo, and signed waiver
- Jobs grouped per property ("when was 123 Maple last washed?")
- **Lifetime metrics**: completed jobs, lifetime invoiced, lifetime paid,
  outstanding balance

### Documents + Google Drive
- "View / Print" generates clean HTML invoices/estimates
- "Save to Drive" uploads to the org's connected Google Drive folder
- "Email to customer" sends documents via Resend

### Form validation, errors, and toasts
- Server actions validated via Zod (`src/lib/validation.ts`)
- Global error boundary (`src/app/error.tsx` + `src/app/global-error.tsx`)
- In-app toast system (`src/components/toast.tsx`) via `useToast()`

### Demo mode
- "Try the demo" button on the login page creates an anonymous Supabase
  session pre-loaded with realistic sample customers, jobs, invoices, expenses
- Demo orgs are flagged `is_demo=true` for easy cleanup
- Requires Authentication → Providers → Anonymous to be enabled in Supabase

### Settings & integrations
- **Business info** — name, address, phone, email, tax rate, currency
- **Numbering prefixes** for invoices and estimates
- **Connect / disconnect Google Drive** (OAuth2 refresh tokens per org)
- **Integration status indicators** for Stripe / Resend / Google Maps / Drive /
  Telnyx / QuickBooks Online
- App degrades gracefully — features without API keys show "not configured"
  hints in Settings → Integrations

### Auth & session persistence
- Email + password sign-up (creates org + default services/categories/lead
  sources via the `handle_new_user()` trigger)
- Auth cookies with `maxAge` of one year and `sameSite=lax`
- Middleware silently refreshes access tokens on every authenticated request
- Users stay signed in on phone or laptop until they explicitly hit **Sign out**

### Security
- **Row-Level Security** on every table via `is_org_member(org_id)` —
  queries are scoped to the user's organization
- Public flows (quote, gallery, review, waiver) use scoped `anon` policies
  with random tokens

---

## App routes (authenticated modules)

`/dashboard`, `/customers`, `/estimates`, `/jobs`, `/calendar`, `/invoices`,
`/payments`, `/expenses`, `/accounting`, `/reports`, `/leads`, `/campaigns`,
`/services`, `/chemicals`, `/equipment`, `/mix`, `/measure`, `/contracts`,
`/waivers`, `/settings`.

## Public flows
`/quote/<token>`, `/gallery/<token>`, `/review/<token>`, `/waiver/<token>`.

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
| `TELNYX_API_KEY` + `TELNYX_FROM_NUMBER` | SMS sending |
| `QBO_CLIENT_ID` + `QBO_CLIENT_SECRET` + `QBO_REDIRECT_URI` + `QBO_ENVIRONMENT` | QuickBooks Online sync |
| `CRON_SECRET` | Securing reminders + contracts cron endpoints |
