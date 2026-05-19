# New customer onboarding

How a new customer (a pressure washing business) goes from "found us" to "first invoice sent."

## Flow (happy path)

1. **Land on `/`** — sees the marketing page.
2. **Click "Start free"** → `/signup`.
3. **Sign up form** — name, company, email, password, accept Terms checkbox.
4. **Supabase Auth** sends a verification email (if email confirmation is enabled in Supabase Auth settings).
5. **User clicks the verification link** → redirected to `/auth/callback` → set as a session → redirect to `/dashboard`.
6. **`handle_new_user` trigger** has already run (during signup):
   - Created an organization with a 14-day trial
   - Seeded 6 default services, 8 expense categories, 6 lead sources
   - Made the user the org `owner`
7. **Dashboard shows empty state** with next-step CTAs.
8. **In-app banner**: "X days left in your free trial" (visible from day 11 onward).

## Recommended first-10-minutes flow for the user

This isn't enforced — but the dashboard nudges them this direction:

1. **Settings** → fill in business info, address, phone, tax rate, upload logo.
2. **Settings → Security** → optional MFA enrollment.
3. **Settings → Integrations** → optional: connect Stripe, Resend (already via API key in env), Telnyx, Google Drive, QuickBooks.
4. **Settings → Stripe Connect** → connect their Stripe account so they can take payments from their own customers.
5. **Customers → New** → add first customer.
6. **Estimates → New** → create first estimate.
7. **Send estimate** → customer approves at `/quote/<token>`.
8. **Jobs** → schedule the work.
9. **Mark job completed** → invoice auto-drafts.
10. **Invoice → Record payment** → first transaction recorded.

## Where to nudge them if they get stuck

The `<NextStepBanner>` component on entity detail pages shows them the next
logical step ("Send estimate to customer?", "Convert to invoice?"). It reads
workflow state from `lib/workflow.ts` and surfaces the action.

## Trial expiry handling

- Day 11: warning banner appears ("3 days left").
- Day 14: trial ends. Status flips to `past_due` automatically (via daily contracts cron).
- Read-only mode kicks in. Banner urges them to subscribe.
- All their data is still there. They can subscribe at `/billing` any time to restore full access.

## Manual onboarding (e.g., friend, white-glove customer)

To set up someone manually:

1. Have them sign up normally.
2. Get their org ID from Supabase (or the audit log).
3. SQL: `UPDATE organizations SET subscription_status='active', trial_ends_at=now() + interval '100 years' WHERE id='<org_id>';`
4. They now have permanent access at zero charge. Document this in your records so you can revoke if needed.

## Customer success metrics to watch

- **Activation rate**: % of trial signups that create at least one estimate. Aim for >50%.
- **Time to first invoice**: median days from signup to first invoice sent. Aim for <7 days.
- **Trial → paid conversion**: % of trial signups that subscribe. SaaS benchmark: 15–25%.
- **D7 retention**: % of signups still active after 7 days. Aim for >70%.

Pull these from Supabase ad-hoc:
```sql
-- Activation rate (last 30 days)
with signups as (
  select id, created_at from organizations
  where created_at > now() - interval '30 days'
),
with_estimate as (
  select distinct organization_id from estimates
  where created_at > now() - interval '30 days'
)
select
  count(*) as total_signups,
  count(*) filter (where id in (select organization_id from with_estimate)) as activated,
  round(100.0 * count(*) filter (where id in (select organization_id from with_estimate)) / count(*), 1) as activation_pct
from signups;
```

## Welcome email (TODO — not yet automated)

Currently no welcome email is sent at signup. Recommended addition:
- Day 0: Welcome email with the 10-step checklist above.
- Day 3: "Need help getting started?" check-in.
- Day 10: "Trial ends in 4 days" reminder.
- Day 14: "Subscribe to keep going" (auto-sent by SaaS billing flow).

This is a 1–2 hour task; add to your roadmap.
