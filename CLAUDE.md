# CLAUDE.md

Project-specific instructions for Claude Code when working on this repository.

## End-session protocol

When the user types **"end session"** (or a clear equivalent), do the following in order:

1. **Update the `## Session log` section of this file** with a dated entry summarizing every change made during the session. Use the structure:
   ```
   ### YYYY-MM-DD — <branch name>
   - bullet for each meaningful change
   - group by feature / fix / docs where it helps
   - reference key files added/modified when useful
   ```
   Append the new entry at the top of the Session log (newest first).

2. **Commit the CLAUDE.md update** to the current working branch with a message like `Update CLAUDE.md with session log`.

3. **Merge the working branch into `main`**:
   - `git checkout main`
   - `git pull origin main`
   - `git merge --no-ff <working-branch>` (preserve history with a merge commit)
   - Resolve any conflicts; if conflicts can't be auto-resolved, stop and surface them to the user before going further.
   - `git push origin main`

4. **Confirm to the user** with the merged commit hash and a one-sentence summary.

Do **not** delete the working branch after merge — keep it for reference.

If the user has uncommitted changes when "end session" is invoked, commit those first with a descriptive message before merging.

## Session log

<!-- newest first; append a new dated entry on every "end session" -->

### 2026-05-20 — claude/setup-wizard-trades-Csqqo

Built the post-signup setup wizard plus a string of UX and data-model
improvements on top of it. Six commits, all pushed to the working
branch.

**Setup wizard with trade-aware seeding** (`1f0bfd5`)
- Schema (`20260603120000_onboarding_wizard.sql`): added
  `organizations.onboarding_step / onboarding_completed_at /
  onboarding_data`; rewrote `handle_new_user` so it no longer
  unconditionally seeds pressure-washing services; backfilled existing
  orgs with `onboarding_completed_at` so middleware doesn't trap them
- 9 new trades: tree_service, fencing, snow_removal, garage_door,
  concrete, irrigation, epoxy_flooring, solar_install, chimney_sweep
- 7-step wizard route group at `src/app/(onboarding)/onboarding/{business,
  trades,tier,addons,billing,messaging,finish}` with shared progress strip
- `src/lib/onboarding.ts` + `onboarding-server.ts` — state machine, step
  ordering, guard that prevents URL-skipping ahead
- `src/lib/billing-checkout.ts` — Stripe Checkout session builder shared
  by the wizard + the existing `/api/billing/checkout` route
- `src/lib/trade-features.ts` — maps each trade to feature keys
  (`chemicals`, `mix_calc`, `measure`, `equipment`, `recurring`); sidebar
  filters nav by the union of selected trades
- Middleware redirects any signed-in user with incomplete onboarding to
  their current step; allowlists `/onboarding`, `/auth`, `/api/billing/
  checkout`, `/legal`, `/api/stripe/webhook`
- Auth callback routes new email-confirmed users straight into the wizard
- Trimmed signup form to email + password + name (business info moved
  into wizard step 1)

**Tax info + labor / material split + draft editing** (`8425ae6`)
- Schema (`20260604120000_tax_info_and_line_kinds.sql`):
  - `organizations.legal_business_name`, `tax_id`, `tax_id_type`,
    `state_tax_id`, `business_structure`, `tax_year_start_month`
  - `estimate_line_items` + `invoice_line_items`: `kind`
    (labor/material/service/other) + `taxable` boolean
  - `estimates` + `invoices`: `labor_subtotal`, `materials_subtotal`,
    `taxable_subtotal` rollups (back-filled `taxable_subtotal = subtotal`
    on existing rows)
  - `services.default_kind` + `default_taxable` so catalog dropdown
    pre-fills the right kind / taxability
- Wizard step 1 now collects legal name + EIN / SSN / ITIN + state
  sales-tax ID + business structure + default sales-tax rate (all
  optional; EINs normalize to digits-only and the doc footer prints
  them as XX-XXXXXXX)
- `src/lib/money.ts`: `computeDocumentTotals` now handles per-line
  taxable + kind, pro-rates discounts across taxable / non-taxable
  lines, returns labor/materials/taxable rollups; 4 new tests
- `LineItemEditor` got a per-line kind dropdown + "Charge tax on this
  line" checkbox with row-aligned hidden markers
- Customer-facing HTML shows `Labor` / `Material` badges per line, a
  "(non-taxable)" hint, a labor/materials breakdown under the subtotal,
  a tax-id footer line
- New `/estimates/[id]/edit` and `/invoices/[id]/edit` routes (draft
  only; redirect with `?locked=1` once sent / accepted / paid). Helpers
  extracted to `helpers.ts` because `actions.ts` is `"use server"`
- Show pages add Edit buttons; convert estimate→invoice copies
  kind/taxable/rollups

**Paired labor/material entries + document-level pictures** (`8e801fc`)
- Schema (`20260605120000_line_groups.sql`): `line_group uuid` on both
  line-item tables to pair labor + material rows; indexes added
- Editor entries now render two-column cards (labor blue / material
  green); each side has its own description / qty / amount / taxable;
  catalog picks auto-route by `default_kind`
- "+ Add picture" button next to "+ Add line" uploads doc-level photos
  with per-photo "Add notes" affordance; persists to
  `photo_attachments` (kind=`reference`, note in `caption`); estimate
  → invoice conversion carries pictures forward
- Customer-facing HTML renders a "Pictures" gallery between line table
  and footer

**Expanded trade catalogs + Settings prompt** (`855e600`)
- Roughly doubled every trade's seeded catalog (4-9 → 11-21 specialty
  services). Highlights: pressure_washing adds composite-deck
  restoration, oxidation removal, brick + masonry, oil/rust/graffiti
  stains, awning/dumpster pad, paver sand; hvac adds refrigerant
  recharge, ductwork, mini-split/heat pump installs, UV sanitizer;
  plumbing adds sewer camera, hydro-jet, tankless/softener/sump pump;
  electrical adds 200A panel, EV charger, generator transfer switch;
  roofing adds full replacement, flashing, ridge vent, ice dam;
  concrete adds exposed aggregate, mudjacking, poly foam leveling
- Wizard finish step + `/services` page show "edit these in Services"
  callouts explaining the catalog feeds the "Add from catalog" dropdown

**Multi-material + per-line pictures + post-job invoice handoff**
(`66a1817`)
- Editor: each entry now allows one labor sub-row plus 1..N material
  sub-rows with "+ Additional material" link; remove buttons appear
  once a line has >1 material; materials JSON-encoded in
  `entry_materials` field
- Per-line "+ Add picture to this line" button uploads to bucket and
  shows thumbnails inline; photos serialize as `entry_photos` JSON and
  land on the first persisted row's `photo_urls` column
- **PDF route bug fix**: `/api/documents/{estimates,invoices}/[id]/pdf`
  were missing the `photo_attachments` join and `kind`/`taxable`/labor
  /material subtotals; customers never saw pictures or breakdowns in
  "View / Print". Fixed both routes.
- Public `/quote/[token]` viewer: per-line kind badges, per-line photos,
  doc-level "Pictures" gallery with notes
- New migration `20260606120000_public_estimate_photos.sql` adds an
  anon-SELECT RLS policy on `photo_attachments` for `kind='reference'`
  photos whose parent estimate carries an `approval_token`, mirroring
  the existing `public read by token` pattern
- **Post-job-completion workflow**: marking a job complete now
  redirects to `/invoices/[id]/edit?from=job` with a green banner so
  the owner reviews + adds completion photos before sending. Auto-
  drafted invoice carries forward kind/taxable/line_group/rollups from
  the estimate (previously lost). Every job photo + estimate reference
  photo gets propagated to `photo_attachments` with `invoice_id` and
  `kind='reference'` so they're already there when the owner opens the
  edit screen.

**Job workflow checklist on the send log** (`3ad456e`)
- `/messages` page now leads with a "Job workflow" table: one row per
  job, customer name + 9 timestamp columns (estimate started, sent,
  approved; job scheduled, completed; invoice drafted, sent; paid;
  receipt sent) + derived status badge
- Empty columns render as dim "—" so stalled jobs jump out
- New component: `src/components/workflow-checklist.tsx`
- Existing email/SMS log moved under an "Email & SMS log" header

**Database ops**
- Twice fully wiped `jason.cochran@universalhazard.com` (user + org
  + cascade-linked data) for clean wizard re-tests
- Wiped transactional data only for `cochranlawncare@gmail.com` —
  receipt_log, payments, invoices, estimates, jobs (with cascades to
  line items, photos, follow-ups, measurements, etc.) and stranded
  `custom_field_values` rows. Kept user, org, customers, services,
  onboarding state, settings.

**Verification**
- tsc clean across every commit
- Tests: 32 passing (was 28; 4 new in money.test.ts cover mixed-tax /
  pro-rated discount / kind rollups)
- Production build green; all new routes (`/onboarding/*`,
  `/estimates/[id]/edit`, `/invoices/[id]/edit`,
  `/onboarding/billing/return`) registered

### 2026-05-19 — main (audit additions pulled into 8bc5eca baseline)

After resetting main to `8bc5eca` (the user's preferred baseline from the
`claude/bulk-document-actions-95rNy` branch), pulled the additive,
conflict-free pieces of `claude/software-audit-UhsOJ` into main so the
documentation and tooling aren't lost.

Added:
- All 8 public legal pages under `src/app/legal/` (terms, privacy, dpa,
  sms-consent, refund, acceptable-use, subprocessors, cookies) + shared
  layout and template-draft disclaimer banner
- `<CookieConsent />` component wired into `src/app/layout.tsx`
- `docs/` — system guides (BILLING, TESTING, MONITORING, HANDOFF, README)
  plus 11 operational runbooks (`01-customer-onboarding` through
  `11-restore-from-backup`) and internal legal templates
  (contractor-ip-agreement, trademark-filing)
- `tests/` — vitest setup with 28 passing tests across csv, money,
  workflow (dropped `tests/billing.test.ts` since main's `lib/billing.ts`
  has a different API than the audit branch — the money/csv/workflow
  tests still pass cleanly against main's helpers)
- `vitest.config.ts` + `npm test` / `test:watch` / `test:ui` scripts in
  `package.json`
- `src/lib/money.ts` — pure financial helpers (applyPayment,
  computeDocumentTotals, computeDeposit, classifyAccessLevel)
- `.github/workflows/db-backup.yml` — weekly encrypted off-site backup
  to Backblaze B2
- `CHANGELOG.md` (root) — customer-facing release notes
- Middleware now allows `/legal/*` without auth

Verified: typecheck clean, 28 tests pass, production build succeeds.

### 2026-05-18 — claude/software-audit-UhsOJ

Full software audit and feature-completion session. Major work across 6 commits.

**Audit findings & critical/high/medium fixes** (`45b446a`)
- Baseline DB migration `20260101000000_baseline.sql` (30 tables, `is_org_member`, `handle_new_user`, `accept_estimate_by_token` RPC, storage buckets, RLS policies)
- Stripe webhook now uses `SUPABASE_SERVICE_ROLE_KEY` (was anon, would fail under RLS)
- `vercel.json` with reminders + contracts cron schedules
- Cron routes accept GET (Vercel) + POST (external)
- `/pdf` routes renamed to `/html` (always served HTML)
- Reports page placeholder cleanup
- GitHub Actions CI workflow
- `.env.local.example` sanitized; 16 tables added to `database.ts`

**Phase 2 features** (`45b446a`)
- Logo upload (Settings + storage bucket + display in sidebar/docs)
- In-app notifications bell with realtime polling
- 2FA TOTP enrollment + `/forgot-password`, `/reset-password`
- Tax forms page (Schedule C summary, 1099-NEC eligible vendors, CSV exports)
- Customer portal at `/portal` with passwordless email magic-link sign-in
- Stripe Connect OAuth onboarding for orgs
- Recurring Stripe subscriptions on contracts
- Inventory auto-deduct on job completion (with low-stock notifications)
- Audit log at `/audit` with `logAudit()` helper
- Edit estimates + invoices (locked when accepted/paid)
- Auto-save drafts component for new/edit pages

**SaaS subscription billing + safety nets** (`c9dbf8b`)
- Migration `20260801000000_billing_and_safety.sql`: subscription columns, pg_cron + pg_net, atomic `claim_due_reminders` RPC, weekly maintenance
- `/billing` page with Stripe Checkout + Customer Portal
- 14-day trial → past_due → cancelled state machine
- Restricted mode via `getSessionAndOrgForMutation` guard on 17 action files
- Subscription banner in app shell
- Sentry SDK wired in (inert without DSN)
- Vitest framework + 15 initial tests
- `docs/BILLING.md`, `TESTING.md`, `MONITORING.md`, `HANDOFF.md`

**Legal pages + operational runbooks** (`aca31fe`)
- 7 public legal pages: `/legal/terms`, `/privacy`, `/dpa`, `/sms-consent`, `/refund`, `/acceptable-use`, `/subprocessors`
- Shared layout, "template draft" disclaimer, footer nav
- Signup now requires accepting Terms + Privacy
- 10 operational runbooks in `docs/operations/`
- Internal: `docs/legal/contractor-ip-agreement.md`, `trademark-filing.md`

**Growth + compliance** (`71ea44c`)
- Migration `20260901000000_growth_and_compliance.sql`: subscription_plans, help_articles, platform_admins, data-deletion fields
- Pre-purge notification: 7-day warning email with "Download my data now" CTA
- `/api/account/export` JSON dump endpoint
- Lifecycle emails: welcome (day 0 via auth/callback), day 3, day 10, day 13
- `/help` and `/help/[slug]` with 8 starter FAQ articles
- Public `/pricing` page
- `/admin/plans` admin UI with broadcast price-change emails
- `src/lib/brand.ts` single source of truth for brand name
- Cookie consent banner + `/legal/cookies`
- `scripts/delete-customer-data.ts` manual GDPR deletion script
- Security review fixes: cron User-Agent bypass removed, portal rate limits, crypto.randomBytes tokens, tightened RLS on review_feedback + estimates with `x-quote-token` / `x-review-token` headers, Stripe webhook idempotency via `stripe_event_log`, portal cookie SameSite=strict, receipt upload path hardening, demo seed guard, email HTML escaping

**Tiers, seats, templates, card-at-signup, changelog, backup, tests** (`601f296`)
- Migration `20261001000000_tiers_seats_templates.sql`: estimates.prepared_by, Plus + Pro tiers seeded, seat/template add-on columns, organization_invites table
- "Prepared by" field on estimates (form + display + customer doc)
- `/team` page with email-invite flow at `/invite/[token]`; Stripe seat line items with proration
- Premium Templates add-on ($5/mo for Plus/Pro): `/settings/document-fields` editor; `src/lib/document-fields.ts` defines togglable fields; `document-html.ts` respects per-org visibility
- Card-required-at-signup: signup → `/onboarding/payment` → Stripe Checkout with `payment_method_collection=always` + 14-day trial. Auto-charged on trial end.
- `/changelog` page reading `CHANGELOG.md`
- Off-site backup GitHub Action: `pg_dump` → AES-256-CBC → Backblaze B2; weekly; 12-week rolling + first-of-month forever retention
- `docs/operations/11-restore-from-backup.md` restore guide
- Tier 1 tests: extracted pure helpers to `src/lib/money.ts` (`applyPayment`, `computeDocumentTotals`, `computeDeposit`, `classifyAccessLevel`); 24 new tests; total now 42 passing
- CI runs `npm test` on every PR

**Meta** (`4507b21`)
- Added `CLAUDE.md` with end-session protocol
