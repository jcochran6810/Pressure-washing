# Failed payments — dunning process

When a customer&apos;s subscription card fails, what happens and what to do.

## Automated flow (already implemented)

```
Customer card declines
   ↓
Stripe fires `invoice.payment_failed` webhook
   ↓
Suds webhook receives event
   ↓
1. organizations.subscription_status = 'past_due'
2. organizations.past_due_since = NOW()
3. Notification inserted (visible in bell icon)
4. Email sent via Resend (throttled to 1 per 24h)
5. App-wide banner shown urging update
6. Mutation guard activates → app becomes read-only
   ↓
Stripe automatically retries 4 times over 21 days
   ↓
Each retry that fails triggers another invoice.payment_failed event
(but email is throttled — only re-sent if >24h since last)
   ↓
Outcomes:
  ✓ Retry succeeds → invoice.paid event → status='active' → email sent
  ✗ All retries fail → customer.subscription.deleted → status='cancelled'
```

## Stripe dunning configuration

Configure in Stripe Dashboard → Billing → Subscriptions → Smart Retries:

Recommended settings:
- **Number of retry attempts**: 4
- **Send card update email**: ON (Stripe sends this on top of our own)
- **Retry intervals**: Stripe&apos;s default (1, 3, 5, 7 days)
- **After retries fail**: Cancel subscription

These settings give the customer 21 days to fix it before cancellation.

## Email cadence (from our system)

| Event | Email subject | Sent by |
| --- | --- | --- |
| First failure | "Your Suds subscription payment didn&apos;t go through" | Suds (via Resend) |
| Each retry failure | (throttled to 1 per 24h, same template) | Suds |
| Retry succeeds | "Your Suds subscription is active again" | Suds |
| Stripe&apos;s built-in emails | Card update reminders | Stripe |

The customer also sees the banner in-app every time they log in.

## When to manually intervene

You don&apos;t need to touch most past-due situations — the system handles them.
Step in when:

- A customer reaches out asking what happened.
- A high-value customer (top 5% by ARR) hits past-due — proactively email/call them.
- An anomaly: multiple cards failing in a short period (could indicate a Stripe issue).

## Manual playbook: customer reaches out

```
1. Pull their org in Supabase:
   SELECT subscription_status, past_due_since, subscription_stripe_id
   FROM organizations WHERE email = '<email>';

2. Pull recent Stripe events:
   Stripe Dashboard → Customers → search by email → View

3. Check the latest invoice attempt → see the decline reason
   (e.g., "Insufficient funds", "Card declined", "Expired card").

4. Respond using this template, substituting in the actual reason:

   Hi [name],

   I see your subscription payment didn&apos;t process — Stripe is reporting
   "[decline reason]". The fastest way to fix this is to update your card
   at https://yourdomain.com/billing → "Manage payment method" — that opens
   Stripe&apos;s portal directly.

   The good news: all your data is safe and still accessible. The moment your
   card clears, your full access is restored automatically.

   Let me know if you hit any issues.

5. After they update: Stripe automatically retries. Don&apos;t manually trigger
   a charge unless they specifically ask.
```

## Manual playbook: emergency restore (e.g., enterprise customer pre-paid)

Sometimes you want to restore access immediately without waiting for Stripe:

```sql
UPDATE organizations
SET subscription_status = 'active',
    past_due_since = NULL,
    past_due_notified_at = NULL
WHERE id = '<org_id>';
```

Audit log this manually:
```sql
INSERT INTO audit_log (organization_id, actor_email, action, entity_type, entity_label, after_data)
VALUES ('<org_id>', '<your email>', 'update', 'subscription', 'Manual restore', '{"reason": "..."}');
```

## Metrics to watch

| Metric | Target | Alert threshold |
| --- | --- | --- |
| Payment failure rate (failed / total attempts) | < 3% | > 7% (investigate Stripe issue) |
| Past-due → recovered rate | > 60% | < 40% (improve dunning emails) |
| Past-due → cancelled rate (involuntary churn) | < 30% | > 50% |

Stripe Dashboard → Revenue → Reports → Failed payments gives you these.

## What to improve later (when you have time)

1. **Personal outreach for VIPs:** auto-flag past-due for any customer paying > $500/mo and Slack-alert yourself.
2. **In-app card-update prompt:** when past-due, show the Stripe Elements card update form inline instead of redirecting to the Customer Portal.
3. **Smart timing:** Stripe Sigma can identify the best retry time for a given customer based on their billing history.
4. **Pre-failure warnings:** Stripe will send "card expiring soon" emails if you enable it.

## Customer-friendly behaviors already implemented

- **Records remain accessible.** Past-due users can still view customers, jobs, invoices, history. They just can&apos;t send new things.
- **Email throttled.** Customer doesn&apos;t get spammed during the 21-day retry window.
- **One-click recovery.** Stripe Customer Portal accepts any card type and immediately retries.
- **Automatic restoration.** No manual unlock needed once the card clears.

These reduce churn vs. industry default of "you&apos;re locked out, call us."
