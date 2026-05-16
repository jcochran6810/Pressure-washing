# Handoff / acquisition readiness

Read this if you're planning to sell the company (your stated goal: 3000–4000 customers, then exit) or onboarding a new technical lead.

The goal of this document: a buyer's technical team should be able to take over operations in **under one week** with no surprises.

## What makes a SaaS acquireable

Buyers evaluate:

1. **Predictable revenue** — Stripe subscription billing handles this. Provide a Stripe export of MRR by month.
2. **Clean codebase** — standard framework (Next.js), conventional patterns, no esoteric dependencies. ✓
3. **Documented infrastructure** — they shouldn't have to guess what runs where.
4. **Transferable accounts** — every third-party service must be transferable to the buyer's organization.
5. **No single point of failure tied to you personally** — your personal accounts can't be required.

## Account ownership — set up RIGHT from day one

Use a **role-based shared account** for every service. Never use a personal account. When you sell, you transfer the inbox + the accounts; that's the deal.

Recommended structure:

| Service | Recommended account email | Why |
|---|---|---|
| Domain registrar | `admin@yourdomain.com` | Transferable owner |
| Vercel | `admin@yourdomain.com` | Same |
| Supabase | `admin@yourdomain.com` | Same |
| Stripe | `admin@yourdomain.com` | Stripe accounts can be transferred via support ticket if needed |
| Resend | `admin@yourdomain.com` | Same |
| Telnyx | `admin@yourdomain.com` | Same |
| Sentry | `admin@yourdomain.com` | Same |
| UptimeRobot | `admin@yourdomain.com` | Same |
| GitHub (this repo) | Org account, NOT your personal | Transfer the org |
| QuickBooks app (developer console) | `admin@yourdomain.com` | Same |
| Google OAuth (developer console) | `admin@yourdomain.com` | Same |

**Action**: create `admin@yourdomain.com` (a Google Workspace inbox costs $7/mo or Fastmail $5/mo). All vendor signups go to this address.

## Code & infrastructure ownership

- **GitHub**: this repo MUST be owned by a GitHub Organization, not a personal account. Create one at github.com → new Organization. Transfer the repo into it now. Add yourself as owner. When you sell, you transfer the org.
- **Branch protection**: enable on `main` — require PR review, require CI green, require linear history. Buyer will expect this.
- **CODEOWNERS file**: identify which areas of the codebase need careful review. Today this is everything = you; future you can split.
- **Secrets**: every secret lives in Vercel env vars + Supabase dashboard. Nothing in code, no `.env` files in the repo. Already correct.

## Documentation buyers will ask for

In the `docs/` folder you now have:

- `TESTING.md` — what's tested, what's not, how to run
- `MONITORING.md` — how alerts work, what to do when one fires
- `HANDOFF.md` — this file

Add these before you start sales conversations:

### `docs/ARCHITECTURE.md` (write at ~1000 customers)
- One-page diagram: browser → Vercel → Supabase → external services
- For each external service, list: what it does, env vars, replacement difficulty
- Database schema overview (just the table list grouped by purpose)

### `docs/RUNBOOK.md` (write at ~500 customers)
- "How do I onboard a new customer?" (just sign up; we don't gatekeep)
- "How do I refund a customer?" (Stripe Dashboard → Customers → find them → refund)
- "How do I temporarily disable a customer?" (`UPDATE organizations SET subscription_status='cancelled' WHERE id='...'`)
- "How do I restore a deleted record?" (Supabase → point-in-time recovery)
- "How do I roll back a bad deploy?" (Vercel → Deployments → previous → Promote)
- "How do I add a new Stripe price tier?" (Stripe Dashboard → Products → ...)

### `docs/COMPLIANCE.md` (write at ~50 customers)
- Privacy policy URL
- Terms of service URL
- Data retention defaults (audit log = 2 years, drafts = 30 days, portal sessions = 7 days post-expiry)
- GDPR / CCPA: how to handle a "delete my data" request (script in `scripts/delete-customer-data.ts` — write this)
- SOC 2: not required at your scale, but Stripe handles card data so PCI scope is minimal

### `docs/REVENUE.md` (write before first investor / buyer conversation)
- MRR history (export from Stripe)
- Customer count by month
- Churn rate (Stripe Dashboard → Revenue → Cohorts)
- Top 10 customers by revenue (Stripe Dashboard)
- Acquisition cost (sum of marketing campaigns ÷ new customers)

## Numbers a buyer will want, available in one query

Your audit log and subscription table already make these answerable:

```sql
-- MRR (monthly recurring revenue)
select
  date_trunc('month', subscription_current_period_end) as month,
  count(*) as active_orgs,
  count(*) * 49 as mrr_usd
from organizations
where subscription_status = 'active'
group by 1 order by 1 desc;

-- Churn (cancelled in last 90 days)
select count(*) from organizations
where subscription_status = 'cancelled'
  and updated_at > now() - interval '90 days';

-- Active vs trial vs paying split
select subscription_status, count(*)
from organizations
group by 1;
```

Save these as `docs/queries.sql`.

## What hurts valuation

Avoid these:

- **Personal accounts for any vendor** — every personal-email signup is a discount on price
- **One-off code in branches or local files** — everything must be in the repo
- **Customer data only in your head** — written runbook required
- **Reliance on third-party APIs without an exit plan** — document how you'd replace Resend, Telnyx, etc.
- **Lawsuits pending** — keep customer support records, signed waivers, audit log. The waiver and audit log systems in this app already help.

## What boosts valuation

- **Clean repo with tests** — write the Tier 1 tests in `TESTING.md` before customer #25
- **High-quality docs** — written in plain English, no jargon
- **Trail of audit log** — buyers can see exactly what's happened
- **Predictable cost structure** — Vercel, Supabase, Stripe are all linear in customers; no surprises
- **Custom domain on professional email** — looks established
- **2FA available** for your end users (already built)

## Recommended timeline relative to your 3000–4000 customer goal

| Customer count | Action |
|---|---|
| 0–25 | Set up `admin@yourdomain.com`, transfer all accounts there. Move repo to a GitHub Organization. |
| 25–100 | Write `ARCHITECTURE.md`, `RUNBOOK.md`. Add Tier 1 tests. |
| 100–500 | Write `COMPLIANCE.md`. Hire a part-time CPA to review books. |
| 500–1500 | Write `REVENUE.md`, set up monthly KPI reports. |
| 1500–3000 | Engage a SaaS broker (Quiet Light, FE International). Get a valuation. |
| 3000+ | List for sale. Typical SaaS multiples: 3–8× annual revenue depending on growth + churn. |

## One specific thing to do today

Create the GitHub organization and move this repo into it. Future you will thank you.

```
Go to https://github.com/account/organizations/new → create "Suds" org
Then: this repo → Settings → Transfer ownership → choose "Suds" org
```

Five-minute task. Saves a week during the acquisition.
