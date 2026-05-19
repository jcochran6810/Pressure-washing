# Billing & Stripe operations

Everything Stripe-related: SaaS billing, Stripe Connect (your customers&apos; payouts), webhook handling, and common operational tasks.

## Two Stripe layers

| Layer | Stripe key used | Who pays | Where money goes |
| --- | --- | --- | --- |
| **Platform / SaaS** | `STRIPE_SECRET_KEY` (your account) | Pressure washing businesses → you | Your bank account |
| **Stripe Connect** | Same key + `stripeAccount: acct_xxx` per request | End customers → the pressure washing business | Their bank account |

Both flow through the same webhook (`/api/stripe/webhook`). Events with `event.account` set are Connect events; without it are platform events. See `docs/BILLING.md` for detail.

## Onboarding a new SaaS customer

Automatic — handled by the signup flow + Stripe Checkout. No manual work needed.

If you&apos;re comping a customer:
```sql
UPDATE organizations
SET subscription_status = 'active',
    trial_ends_at = NOW() + INTERVAL '100 years',
    subscription_plan = 'comp'
WHERE id = '<org_id>';
```

## Looking up a customer in Stripe

Two paths:

1. **From their email**: Stripe Dashboard → Customers → search by email.
2. **From the org**: get `subscription_customer_id` from Supabase, paste in Stripe Dashboard → Customers → paste the `cus_xxx` ID.

## Common operations

### Refund a SaaS subscription charge

1. Stripe Dashboard → Payments → search by email or amount.
2. Click the charge → Refund.
3. Optionally cancel the subscription too.
4. Refund posts in 5–10 business days to the customer&apos;s statement.

Audit log entry is NOT auto-created (Stripe is the source of truth). Log it manually if you want a Suds-side record.

### Pause a subscription (don&apos;t cancel)

Stripe Dashboard → Customers → find them → Subscriptions → Update → Pause.

Choose:
- **Mark uncollectible** (no charges) — useful for medical leave / vacation pauses.
- **Keep as draft** — bills accumulate but aren&apos;t collected.

Pausing keeps the customer in your Stripe records but stops billing. You can resume any time.

In Suds: their status will reflect Stripe&apos;s state via webhook. You may want to manually update `subscription_status='active'` so they still have full app access:
```sql
UPDATE organizations SET subscription_status='active' WHERE id='<org_id>';
```

### Change a customer&apos;s plan / price

Currently single-plan. When you add tiers:

1. Stripe Dashboard → Subscriptions → find → Update → swap to new price.
2. Prorate if appropriate (Stripe handles this).
3. Webhook fires `customer.subscription.updated` → no Suds-side change needed.

### Issue a one-time charge

For an ad-hoc charge (e.g., setup fee, training session):

1. Stripe Dashboard → Customers → find → Create payment → invoice or charge.
2. Choose invoice (email) or one-off charge (uses default payment method).
3. NOT auto-logged in Suds — manual note if useful.

### Migrate a customer to a different Stripe account

(E.g., if you change legal entities mid-business.)

This is a Stripe Support ticket. They can transfer customers, subscriptions, and history between accounts. Allow 1–2 weeks.

## Webhook setup (do this once per environment)

### Production

Stripe Dashboard → Developers → Webhooks → Add endpoint:
- URL: `https://yourdomain.com/api/stripe/webhook`
- Events to subscribe to:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.paid`
  - `invoice.payment_failed`
  - `account.updated`
- After creating: copy the signing secret → Vercel env `STRIPE_WEBHOOK_SECRET`.

### Local development

Use the Stripe CLI:
```
stripe listen --forward-to localhost:3000/api/stripe/webhook
```
This forwards events to your local server and prints the temporary signing secret. Set it as `STRIPE_WEBHOOK_SECRET` in your `.env.local`.

### Connect events

If you&apos;re testing Stripe Connect flows, Connect events come through the SAME webhook endpoint, but you may need to enable them in a separate "Connect" tab in Stripe Dashboard → Webhooks → your endpoint → "Listen to events on Connected accounts."

## Stripe Connect (for your customers&apos; customers)

### Onboarding a business onto Stripe Connect

User flow:
1. Settings → Integrations → Stripe Connect → "Connect"
2. Redirected to Stripe-hosted onboarding (Express account)
3. Returned to `/api/stripe/connect/return` which polls account status
4. Once `charges_enabled && payouts_enabled` → status: active

Some accounts get held in `pending` review for hours to days. This is Stripe&apos;s risk team checking the business. Nothing you can do; tell the customer to be patient.

### Connected account dashboard access

For the customer: `/api/stripe/connect/dashboard` creates a one-time login link
to their Stripe Express dashboard, where they can:
- View payments + payouts
- Update bank info
- Set tax info
- Download statements

### Failed payouts

Stripe will email you if a connected account&apos;s payout fails (wrong bank info,
account closed). Forward the email to the customer with instructions to update
their bank info via the Connect dashboard link above.

## Pricing changes

When you change your subscription price:

1. **Create a new price in Stripe Dashboard**, don&apos;t modify existing one.
2. Update `STRIPE_SUBSCRIPTION_PRICE_ID` env var on Vercel.
3. **Existing customers stay on the old price.** New signups get the new price.
4. To migrate existing customers (with notice, 30 days minimum):
   - Email customers about the change.
   - Bulk-update their subscriptions in Stripe via API or dashboard.
   - Or wait until they cancel and re-subscribe.

## End of month / quarter / year tasks

### Monthly
- Reconcile Stripe payouts against your bank statement (5 min).
- Review failed payment rate; if elevated, dig into reasons.
- Check chargeback rate (should be < 0.5% — anything > 1% triggers Stripe review).

### Quarterly
- Audit comped accounts (any you forgot to bill?).
- Review subscription metrics: MRR, churn, expansion.
- Export Stripe data for accountant.

### Annually
- Tax forms — Stripe issues 1099-K to you automatically if you cross thresholds.
- W-9 for any contractors paid via Stripe.
- Review and renew Stripe Connect onboarding requirements (Stripe periodically requires re-verification).

## Stripe Dashboard navigation tips

- **Saved views**: create filtered customer lists for "VIPs", "Past due", etc.
- **Sigma**: ($1/100 rows) write SQL against Stripe data. Useful for custom dashboards.
- **Radar rules**: configure fraud rules. Default settings are good; tighten if you see fraud.

## When NOT to use Stripe

- Refunding outside Stripe&apos;s window (>180 days): Stripe blocks. You&apos;d have to refund manually via ACH or check.
- Bulk operations across many customers: write a script using Stripe&apos;s API rather than clicking 100 times in the dashboard.
- Customer signed up with a card that can&apos;t do recurring (e.g., some prepaid cards): handle as a special case.

## Stripe API rate limits

Stripe&apos;s rate limits are generous: 100 read + 100 write requests per second.
You won&apos;t hit these in normal operation. If you do (mass migration script,
etc.), implement exponential backoff.
