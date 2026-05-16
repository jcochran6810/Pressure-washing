# SaaS billing — how subscriptions work

This is the layer where YOU charge pressure washing businesses for using the app.
It's separate from Stripe Connect (which is where each business charges THEIR customers).

## Two Stripe accounts at play

| Account | Whose money | Used for |
|---|---|---|
| **Your platform Stripe account** (the one tied to `STRIPE_SECRET_KEY`) | You collect from businesses | SaaS subscriptions (this doc) |
| **Each business's connected Stripe account** (`stripe_connect_account_id` on `organizations`) | Each business collects from their customers | Payment links on invoices, recurring billing on contracts |

The webhook at `/api/stripe/webhook` handles BOTH. It distinguishes them by whether `event.account` is set:
- `event.account` IS set → connected-account event (a business charging their customer)
- `event.account` is NOT set → platform event (you charging a business)

## Subscription states

Every organization has `subscription_status` in `{ trialing, active, past_due, cancelled }`.

| State | Trigger | Access |
|---|---|---|
| `trialing` | New signup (14-day default) | Full while within `trial_ends_at`; restricted once trial expires |
| `active` | Stripe `customer.subscription.created` or successful payment | Full |
| `past_due` | Stripe `invoice.payment_failed` | **Read-only** — see records, send nothing |
| `cancelled` | Stripe `customer.subscription.deleted` | **Read-only** — see records, send nothing |

The state machine is enforced two ways:
1. **`getSessionAndOrgForMutation()`** in `src/lib/org.ts` throws `SubscriptionRequiredError` for restricted statuses
2. **`<SubscriptionBanner>`** in the app shell shows a banner urging the user to fix it

## What's restricted vs allowed when past-due

**Allowed (read-only access):**
- Viewing all customer records, properties, history
- Viewing past invoices, estimates, jobs, payments, photos
- Viewing audit log, reports, tax forms
- **Updating settings + integrations** (so they can fix Stripe Connect, etc.)
- **Subscription management** (start, update payment method, cancel) — the whole point is they can fix it

**Blocked:**
- Creating new estimates, invoices, jobs, customers, leads
- Updating any of the above
- Sending email or SMS
- Generating Stripe payment links
- Photos & gallery actions
- Contract automation

The action files all use `getSessionAndOrgForMutation` (aliased as `getSessionAndOrg`). Any file with that import is gated. Files using `getSessionAndOrg` directly (settings, services catalog, billing itself) are NOT gated.

## Setting your subscription price

Pre-create a Price in your Stripe Dashboard:

1. Stripe Dashboard → Products → New Product
2. Name: "Suds — Pressure Washing Business Manager"
3. Pricing: Recurring · Monthly · $49 (or your preferred price)
4. Save → copy the Price ID (`price_...`)
5. Set `STRIPE_SUBSCRIPTION_PRICE_ID` env var in Vercel

If you skip this step, the app creates a $49/mo product the first time someone subscribes. The pre-create path is cleaner because the price stays consistent across customers.

## Webhook events handled

| Event | Effect |
|---|---|
| `checkout.session.completed` (with `saas_subscription=1` metadata) | Set `subscription_status=active`, store `subscription_stripe_id` |
| `customer.subscription.updated` | Sync status (active / past_due / cancelled / trialing) |
| `invoice.payment_failed` | Set `past_due`, email the owner (once per past-due cycle) |
| `customer.subscription.deleted` | Set `cancelled`, clear `subscription_stripe_id` |

## Test mode walkthrough

To verify end-to-end before going live:

1. Set `STRIPE_SECRET_KEY=sk_test_...` and `STRIPE_WEBHOOK_SECRET=whsec_test_...`
2. Run `stripe listen --forward-to localhost:3000/api/stripe/webhook` in a terminal
3. Sign up a fresh org, hit `/billing`, click Subscribe
4. Use test card `4242 4242 4242 4242` → confirm `subscription_status = active`
5. To simulate failure: go to Stripe Dashboard → Customers → find your test customer → Subscriptions → simulate failed payment
6. Confirm: banner appears, email sent (check Resend logs), creating an estimate throws

## Email flow for past-due

When Stripe fires `invoice.payment_failed`:

1. The webhook sets `subscription_status=past_due` and `past_due_since=now()`
2. If `past_due_notified_at` is null or > 24 hours ago, send `emailPaymentFailed`
3. Stripe retries 4 times over 21 days (configurable in Stripe Dashboard → Billing → Subscriptions → Smart Retries)
4. Each retry triggers another `invoice.payment_failed`, but we throttle emails to one per 24 hours
5. When the card eventually clears, Stripe fires `customer.subscription.updated` with status `active` → we send `emailSubscriptionRestored`
6. If Stripe gives up after 21 days, it fires `customer.subscription.deleted` → status becomes `cancelled`

The throttle means the customer gets ~3 emails over the 21-day window, not 21 emails.

## Manual subscription operations

### Mark an org as paying (e.g., a friend who you're not charging)
```sql
update organizations
set subscription_status = 'active',
    trial_ends_at = now() + interval '100 years'
where id = '...';
```

### Refund a customer
- Stripe Dashboard → Payments → find the charge → Refund
- The webhook doesn't auto-handle refunds. To restore access, manually flip status back if needed.

### Cancel a customer immediately (not at period end)
- Stripe Dashboard → Customers → find them → Subscriptions → Cancel → "Immediately"
- Webhook flips `subscription_status` to `cancelled`

### Grant extra trial time
```sql
update organizations
set trial_ends_at = now() + interval '30 days',
    subscription_status = 'trialing'
where id = '...';
```

## Caveats and known limits

- **No Stripe Tax integration** — sales tax handling is on you / your customer
- **No annual billing** — only monthly. Add a second `STRIPE_SUBSCRIPTION_PRICE_ID_ANNUAL` env var and a Stripe price to support it.
- **No tiered plans** — single Starter plan. To add tiers, extend `subscription_plan` column and route customers to the right Stripe price.
- **No proration UI** — Stripe handles proration when switching plans, but there's no UI flow yet
- **No team seats** — billing is per-org, not per-user. If you add team management later, decide whether to bill per seat.

## Stripe Customer Portal config

Stripe's hosted customer portal (`openCustomerPortal` action) needs to be configured once:

1. Stripe Dashboard → Settings → Billing → Customer portal
2. Enable: update payment method, view invoices, cancel subscription
3. Disable: switch plans (until you have tiers)
4. Save

This is hosted by Stripe — you don't need to build anything.
