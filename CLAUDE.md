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
