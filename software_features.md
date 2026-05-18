# Suds — Software Features Reference

**Suds** is an all-in-one business management platform for home-services
operators (pressure washing, lawn care, landscaping, HVAC, plumbing, pool,
pest, painting, handyman, cleaning, roofing, holiday lights, and more —
21 trades supported). Built with Next.js 14 (App Router), Supabase, Tailwind,
Stripe (subscription billing + Stripe Connect), Resend / Telnyx, Google Drive,
Google Calendar, and Google Maps.

> Branch surveyed for this doc: `claude/bulk-document-actions-95rNy`
> (the most up-to-date branch, 20 commits ahead of `main`). `main` already
> includes Phase 8 subscription billing + Phase 9 Stripe Connect; the bulk
> branch additionally adds the **Basic / Plus / Pro** restructure, the 10-day
> free trial, Pro quota add-on packs, the per-trade add-on, customer portal,
> public booking widget, platform admin dashboard, comped access, etc.

---

## Subscription tiers (source of truth: `src/lib/billing.ts`)

Every new org gets a **10-day free trial** (`TRIAL_DAYS = 10`) with full
access. Stripe also enforces the trial via `trial_period_days` at checkout.
After the trial, access requires an active Stripe subscription **or** a
platform-admin-granted comped access record.

| Tier      | Price       | Seats        | Email/mo | SMS/mo | BYOC keys | Auto reviews | Custom branding | Priority support |
|-----------|-------------|--------------|----------|--------|-----------|--------------|-----------------|------------------|
| **Basic** | **$5/mo**   | 1            | 0        | 0      | No        | No           | No              | No               |
| **Plus**  | **$15/mo**  | 3            | 200      | 100    | No        | Yes          | Yes             | No               |
| **Pro**   | **$45/mo**  | Unlimited    | 1,500    | 750    | Yes       | Yes          | Yes             | Yes              |

### Tier feature bullets (as shown on the plan cards)

**Basic — $5/mo** — *"The essentials for a solo operator getting started."*
- 1 user seat
- Estimates, invoices & job scheduling
- Customer & property records
- Email support
- No included email or SMS (upgrade to Plus to send messages)

**Plus — $15/mo** — *"Growing crews who need automation and outbound messaging."*
- Up to 3 user seats
- 200 platform emails / month
- 100 SMS messages / month
- Automated review requests
- Custom branding on documents
- Upgrade to Pro for higher send volume

**Pro — $45/mo** — *"High-volume teams that need every feature and headroom to grow."*
- Unlimited user seats
- 1,500 platform emails / month
- 750 SMS messages / month
- Automated review requests
- Custom branding on documents
- Bring-your-own email & SMS keys (BYOC)
- Stripe Connect for per-business payments
- Priority support
- Add quota packs for +5,000 emails & +1,500 SMS each

### Pro quota add-on packs
- `PRO_ADDON_EMAIL_PER_PACK = 5,000` extra emails per pack
- `PRO_ADDON_SMS_PER_PACK = 1,500` extra SMS per pack
- Priced via `STRIPE_PRICE_ID_PRO_ADDON`
- Stackable — add as many packs as you need

### Multi-trade add-on
- First **2 business types** are included with every plan
- Each additional trade: **$3.99/mo** (`BUSINESS_TYPE_ADDON_MONTHLY_PRICE`)
- Priced via `STRIPE_PRICE_ID_BUSINESS_TYPE_ADDON`
- Adds the trade's default service catalog and custom-field templates to the org

### Bring-your-own credentials (BYOC) — Pro only
- Use your own Resend API key for email and your own Telnyx key for SMS
- Per-org keys are **encrypted at rest** (`src/lib/crypto.ts`)
- BYOC mode bypasses the platform-tier email/SMS quotas (operator pays their provider)
- Switch modes from Settings → Messaging

### Comped (free) access
- Platform admins can grant free access to friends, beta testers, internal accounts
- `access_grants` table tracks plan tier, reason, granted-by, expiration, revoke history
- `resolveOrgAccess()` consults both Stripe subscription status and active grants

### Trial lifecycle
- New orgs get `trial_ends_at = now() + 10 days`
- In-app banner counts down the trial
- Trial-end + trial-warning emails sent via the messaging system
- After trial: restricted mode unless they subscribe or are comped

---

## Supported trades (21)

`pressure_washing`, `lawn_care`, `landscaping`, `house_cleaning`,
`window_cleaning`, `gutter_cleaning`, `painting`, `handyman`, `hvac`,
`plumbing`, `electrical`, `pool_service`, `pest_control`, `junk_removal`,
`carpet_cleaning`, `mobile_detailing`, `roofing`, `appliance_repair`,
`dryer_vent`, `holiday_lights`, `general_home`.

Each trade ships with its own default service catalog, recommended pricing
units, and trade-specific custom-field templates (e.g. gate code + yard size
for lawn, fixture model + serial for appliance repair).

---

## Feature inventory

### Money path — quote → invoice → paid
- Customers + multi-property records
- **Estimates** with line items, 30-day expiry, deposit thresholds, internal
  duration + buffer, per-line-item photos, measurement-modal line items
- **Digital approval** — public `/quote/<token>` link the customer can
  approve or decline; auto-creates the job on acceptance
- **Edit-in-any-status** — fix typos on sent estimates / invoices / receipts
  and re-send
- **Review-before-send** step before invoice goes to customer
- Estimate → invoice → payment → receipt flow
- **Stripe payment links** with auto-record on webhook
- **Stripe Connect** (Pro) — payments land in the operator's own connected
  Stripe account, not the platform's
- **Card-on-file** + card-terminal payment recording
- Manual payment recording (cash / check / card / ACH)
- **Real PDF export** for estimates and invoices (not just print-HTML)
- **Unified YY-NNNN document numbering** across all doc types
- **Drive archive** — every issued PDF backed up to the org's Google Drive

### Field operations
- **Jobs** with status (scheduled → in progress → completed), per-job photos,
  and per-line-item photos
- **Drag-and-drop calendar** (week/day) + **month calendar view**
- **Auto-schedule** workflow — schedule job dialog appears at quote acceptance
- **Appointment reminders** auto-scheduled when a job is booked (default 24 h)
- **Before/after photo galleries** with public token URL
- **Photo annotations** — canvas editor (arrows, boxes, circles, freehand,
  text); annotated render uploaded back to storage
- **Auto-invoice on completion** (toggle)
- **Workflow stepper** + **Next-step banner** — surfaces the next action for
  every open record

### Recurring & contracts
- **Recurring jobs** ("mow Sarah's lawn every 2 weeks at $45") — daily,
  weekly, biweekly, triweekly, monthly, quarterly, semiannual, annual,
  seasonal, or custom-days cadence; cron rolls them forward
- **Contracts** — monthly / quarterly / annual service plans that auto-draft
  estimates (and optionally jobs)
- **Follow-ups** — personal task list per org (call, text, email, site
  visit, quote follow-up, review request, collection); attach to any
  customer / lead / estimate / job / invoice
- Cron endpoints: `/api/cron/reminders`, `/api/cron/contracts`,
  `/api/cron/recurring`

### Services & pricing (catalog config)
- Service catalog with 15 pricing units: flat, hour, sq ft, linear ft, room,
  each, visit, month, acre, fixture, window, panel, load, cubic yard,
  square (roofing)
- Per-service **material modifiers** (concrete, brick, stucco, vinyl, wood,
  composite, roof shingle, roof tile, pavers) and **height-per-story
  modifier**
- **Per-service min charge** + **global minimum job total**
- **Deposit threshold** + configurable **deposit percentage** (default 25 %)
- **Deposit checkout** (Phase 1) — collect deposit via Stripe at acceptance
- Add-on services
- **Load trade defaults** — one-click seed the catalog for any of the 21
  supported trades

### Custom fields
- Per-org user-defined fields on customer / lead / estimate / job / invoice
  / property
- 10 field types: text, long text, number, currency, dropdown, checkbox,
  date, phone, email, url
- Required + customer-visible flags, sort order, active flag
- Each trade ships with a recommended starter set

### Customer portal & public booking widget
- **Customer portal** at `/portal/<token>` — magic-link login for the
  customer to see history, estimates, invoices, pay outstanding balances
- **Public booking widget** at `/book/<org-slug>` — anonymous lead capture
  form that drops into the org's lead pipeline
- **Public org profile** (`organizations.slug`) — branded landing
- **Short links** at `/u/<token>` for SMS-friendly quote / invoice URLs

### Inventory
- **Chemicals** with current stock, reorder levels, SDS URL, hazard class —
  pre-loaded with common pressure-washing chemicals on sign-up
- Chemical transactions: purchase / usage / waste / adjustment
- **Mix calculator** for SH ratios and surfactant
- **Equipment tracking** — serial, purchase price/date, current value, hours
  used, next service date

### Accounting & sync
- Income auto-calculated from recorded payments
- **Expense logging** with categories, vendors, deductible flag, **receipt
  photo upload**, expenses analytics page
- **Live P&L** for any period
- **6-month revenue vs expense** chart, **vendor breakdown**, **payment
  method mix**
- **Service performance** + **top customers** in reports (Phase 4)
- **CSV exports** for QuickBooks / Xero / Wave / FreshBooks
- **QuickBooks Online live sync** via OAuth
- **Tax export aligned to IRS Schedule C** with equipment depreciation
- **Off-site backup** of accounting data

### Marketing
- **Lead pipeline** (new → contacted → quoted → won/lost) — receives leads
  from the public booking widget too
- **Campaign tracker** (budget, spend, impressions, clicks, conversions)
- **Lead sources** (Google, FB, referral, yard sign, …)
- **Auto review request** after invoice paid — 1–3★ routed internally,
  4–5★ routed to Google

### Measurement
- **Satellite polygon tool** at `/measure` (Google Maps Drawing / Geometry
  / Places / Geocoding)
- Tag polygons with material + service
- Attach measurements to a property and **auto-build estimate line items**
  from the measurements
- Auto-set property GPS for future jobs

### Reminders & messaging
- Per-job appointment reminder + per-customer recurring service reminder
- **Pre-made email + SMS templates** (estimate-send, invoice-send, receipt,
  payment reminder, appointment reminder, review request, contract
  renewal, waiver request) — customisable per org
- **Telnyx SMS** for all transactional sends; **Twilio SMS** option also
  scaffolded
- **Send log** at `/messages` — every email/SMS this org has sent (who,
  when, status)
- **Per-org messaging prefs** + customer unsubscribe support
- **Quota enforcement** at the sender layer against the tier limits

### Waivers & signed documents
- Author multiple liability waivers per org (versioned, active flag)
- Send via email or SMS; customer signs in-app with a touch/mouse signature pad
- Audit trail: IP, user agent, timestamp, signed text, signature image
- Public sign URL at `/waiver/<token>`

### Customer service history
- `/customers/<id>/history` aggregates every estimate, job, invoice,
  payment, photo, signed waiver
- Jobs grouped per property
- Lifetime metrics: completed jobs, lifetime invoiced, lifetime paid,
  outstanding

### Branding & documents
- **Logo upload** (per-org Supabase `branding` storage bucket)
- **Branded PDFs** — invoices, estimates, receipts use the org's logo +
  colors
- **Premium document templates** (Pro / customer-branding tier)
- "View / Print", "Save to Drive", "Email to customer" actions

### Google integrations
- **Google Drive** — OAuth2, document archive
- **Google Calendar** — bidirectional sync; show linked Calendar when
  scheduling an approved job
- **Google Maps** — measurement tool

### Notifications & nav
- **In-app notifications bell** with nav badges
- **Today-first dashboard** + dashboard hub
- **5-tab mobile bottom nav** + flat bottom-bar Add button
- **First-run welcome banner** on Today
- **Workflow stepper** across estimate → job → invoice → payment lifecycle

### Security & auth
- Email + password sign-up; **2FA** support
- **Pre-deletion warning** on destructive actions, **auto-save** drafts
- **Audit log** of org-level user actions
- **Cookies** banner + lifecycle / legal pages
- Auth cookies `maxAge = 1 year`, `sameSite=lax`; middleware silently
  refreshes the access token
- **Row-Level Security** on every table via `is_org_member(org_id)`
- Public flows (`/quote`, `/gallery`, `/review`, `/waiver`, `/portal`,
  `/book`) use scoped `anon` policies with random tokens
- **BYOC keys encrypted at rest**

### Platform admin (`/admin`)
- Dedicated admin login (hidden from in-app nav)
- Dashboards: **Companies**, **Users**, **Subscriptions**, **Payments**,
  **Usage**, **Errors**, **Actions** (audit log)
- **Admin actions log** — every admin op recorded
- **App errors log** — runtime errors surfaced
- **Pricing admin** — adjust plan visibility / Stripe price IDs
- **Suspend abusive accounts** (`organizations.disabled_at`)
- **Grant comped access** with reason + expiration

### Operations & safety nets
- **Lifecycle emails** (welcome, trial warning, trial end, payment failed)
- **Restricted mode** when subscription lapses
- **FAQ**, **legal pages**, **ops runbooks**, **trademark guide**,
  **contractor IP template**
- **Changelog** in-app
- **Tier 1 automated test suite**
- Global error boundary (`error.tsx` + `global-error.tsx`) + Zod validation
  on every server action + in-app toast system

### Demo mode
- "Try the demo" on login creates an anonymous Supabase session pre-loaded
  with realistic customers, jobs, invoices, expenses
- Demo orgs flagged `is_demo=true` for cleanup

---

## App routes (authenticated)
`/dashboard` (Today-first), `/customers`, `/properties`, `/leads`,
`/estimates`, `/jobs`, `/calendar`, `/recurring`, `/follow-ups`, `/contracts`,
`/invoices`, `/payments`, `/expenses`, `/accounting`, `/reports`,
`/campaigns`, `/services`, `/custom-fields`, `/chemicals`, `/equipment`,
`/mix`, `/measure`, `/waivers`, `/messages`, `/settings`.

## Public flows
`/quote/<token>`, `/gallery/<token>`, `/review/<token>`, `/waiver/<token>`,
`/portal/<token>` (customer portal), `/book/<slug>` (booking widget),
`/u/<token>` (short links).

## Platform admin
`/admin/login`, `/admin` (dashboard), `/admin/companies`, `/admin/users`,
`/admin/subscriptions`, `/admin/payments`, `/admin/usage`, `/admin/errors`,
`/admin/actions`.

## Required environment variables

| Variable | Required for |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | All |
| `NEXT_PUBLIC_APP_URL` | Public links, OAuth redirects |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Payments + subscriptions |
| `STRIPE_PRICE_ID_BASIC` / `STRIPE_PRICE_ID_PLUS` / `STRIPE_PRICE_ID_PRO` | Tier checkout |
| `STRIPE_PRICE_ID_PRO_ADDON` | Pro quota add-on packs |
| `STRIPE_PRICE_ID_BUSINESS_TYPE_ADDON` | Per-trade add-on beyond first 2 |
| `RESEND_API_KEY` + `RESEND_FROM` | Platform email (when not BYOC) |
| `TELNYX_API_KEY` + `TELNYX_FROM_NUMBER` | Platform SMS (when not BYOC) |
| `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` | Drive + Calendar OAuth |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Satellite measurement |
| `QBO_CLIENT_ID` + `QBO_CLIENT_SECRET` + `QBO_REDIRECT_URI` + `QBO_ENVIRONMENT` | QuickBooks Online sync |
| `CRON_SECRET` | Securing cron endpoints |
| `BYOC_ENCRYPTION_KEY` | Encrypting per-org Resend / Telnyx keys |
