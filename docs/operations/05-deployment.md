# Deployment — how code goes live

## Stack

- **Hosting:** Vercel (Pro plan)
- **Source:** GitHub repo, branch `main` is production
- **Database:** Supabase (manual migrations)
- **CI:** GitHub Actions (`.github/workflows/ci.yml`)

## Normal flow (PR-based)

```
1. Create a feature branch locally:
   git checkout -b feature/short-description

2. Code, test locally:
   npm run dev
   npm run typecheck
   npm test
   npm run lint

3. Commit and push:
   git push -u origin feature/short-description

4. Open PR on GitHub.
   - CI runs: typecheck + lint + build + tests
   - Vercel creates a preview deployment at pr-NN-suds.vercel.app
   - Test the change on the preview URL

5. Self-review (or get a reviewer for risky changes).
   - Read the diff. Did you change anything you didn't mean to?
   - Run through the obvious affected user flows on the preview.

6. Merge to main.
   - Vercel automatically deploys to production within ~90 seconds.
   - Run a smoke test: log in, view dashboard, hit the main pages.

7. Watch Sentry + Vercel logs for 10 minutes.
```

## Hotfix flow (production is broken)

```
1. Identify the regression. Usually obvious from Sentry or a user complaint.

2. If the issue was introduced by the most recent deploy:
   Vercel Dashboard → Deployments → previous successful deploy → "Promote to Production"
   ~30 seconds. Site is restored to the previous version.

3. Then fix forward:
   git checkout main && git pull
   git checkout -b hotfix/short-description
   make the fix
   commit + push + PR + merge

4. If the issue is from migrations: see /docs/operations/06-database-backups.md
   (roll forward, never roll back migrations).
```

## Migrations (database changes)

Migrations are **manual** — they don&apos;t deploy with code. Apply them in
Supabase SQL editor or via `supabase db push`.

### Workflow

1. Write the migration in `supabase/migrations/YYYYMMDDhhmmss_description.sql`.
2. **Test in staging** (separate Supabase project) first.
3. Coordinate with code:
   - If the migration adds columns: deploy code that reads them safely (using `?? defaults`) FIRST, then apply migration.
   - If the migration removes columns: apply migration FIRST, then deploy code.
   - If the migration is purely additive: order doesn&apos;t matter, but apply migration before code that depends on it.
4. Apply to production via Supabase Dashboard → SQL Editor.
5. Verify with a smoke test.

### Migration order so far

1. `20260101000000_baseline.sql` — base schema
2. `20260513120000_features_pack.sql` — contracts, waivers, etc.
3. `20260601000000_features_v2.sql` — audit, notifications, drafts
4. `20260801000000_billing_and_safety.sql` — SaaS billing + cron backups

When you add #5, append at the end and apply via dashboard.

## Environment variables

Source of truth: **Vercel Project Settings → Environment Variables**.

For local dev, copy `.env.local.example` to `.env.local` and fill in the same values.

When adding a new env var:
1. Add to `.env.local.example` (with a placeholder, not the real value).
2. Add to Vercel.
3. Mention in the relevant doc (BILLING.md, MONITORING.md, etc.).

## Releases

We don&apos;t do versioned releases (no `v1.2.3` tags). Every merge to main IS a release.

Optional addition: maintain a `CHANGELOG.md` for customer-facing release notes.
Update it when shipping notable changes. Pin it to a /changelog page (TODO).

## Rollback strategy

- **Code rollback:** Vercel Promote to Production (any prior deployment).
- **Database rollback:** Supabase PITR (point-in-time recovery), 7-day window on free tier, longer on Pro. See `06-database-backups.md`.

**Important:** don&apos;t database-rollback for a code bug. The data is fine; the
code is broken. Rollback the code.

## Pre-deployment checklist (for risky changes)

For changes that touch payments, auth, or webhooks:

- [ ] Tested locally
- [ ] Tested on preview deployment
- [ ] CI green
- [ ] Stripe webhook still firing (check Stripe Dashboard → Developers → Webhooks)
- [ ] No new errors in Sentry after 10 minutes
- [ ] If it touches the schema, migration applied first
- [ ] If it touches a public API, backwards-compat preserved

## Deployment cadence

- **Bug fixes:** as needed.
- **Small features:** daily / multiple times per day.
- **Schema migrations:** off-peak hours (Sunday evening / overnight), low traffic.
- **Major features:** post in your future #changelog channel and email customers about meaningful changes.

## Who can deploy

Currently: only you, via the merge button on GitHub.

When you add team members:
- Junior: PRs require review before merge. Cannot merge their own.
- Senior: can self-merge for small changes; PR review for anything > 100 lines or touching payments/auth/webhooks.
- Branch protection on `main` enforces this.

Configure: GitHub repo → Settings → Branches → Branch protection rules → main:
- [x] Require pull request before merging
- [x] Require status checks (CI) to pass
- [x] Require linear history
- [x] Do not allow bypassing the above settings (even for admins, ideally)

## When in doubt

Roll back. Cost of an extra rollback: $0 and 2 minutes. Cost of a bug live for an hour: variable but often much more.
