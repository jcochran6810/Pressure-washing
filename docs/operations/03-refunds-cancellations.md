# Refunds & cancellations

Standard workflow for handling subscription refund requests and account cancellations.

## Policy at a glance

(Public version: `/legal/refund` — keep this internal doc in sync.)

| Scenario | Action |
| --- | --- |
| First 7 days of paid service | 100% refund, no questions asked |
| After 7 days, current month | No pro-rated refund. Cancel at period end, retain access until then. |
| Duplicate charge | Always refund |
| Unauthorized charge (fraud) | Always refund + investigate |
| Service down > 24h continuous | Refund pro-rated for outage period |
| Customer just doesn&apos;t want it anymore (months in) | Cancel at period end; don&apos;t refund the current month |
| Customer threatens chargeback | Refund + ask for friendly resolution |

## Workflow: customer-initiated cancellation

The customer self-serves at **Billing → Cancel subscription**:

1. Click triggers `cancelSubscriptionAtPeriodEnd()` server action.
2. Stripe API sets `cancel_at_period_end = true` on the subscription.
3. Stripe fires `customer.subscription.updated` webhook.
4. Webhook records the change in `audit_log` and `notifications`.
5. Customer retains full access until period end.
6. At period end, Stripe fires `customer.subscription.deleted` → status flips to `cancelled` → restricted mode.

**No action required from you.** Optional: a personal email asking why they cancelled. Aim for <40% reply rate; the feedback is gold.

## Workflow: customer-initiated refund

1. Customer emails support requesting refund.
2. Verify identity (account email matches the sender).
3. Apply policy:
   - Within 7 days of first charge → full refund.
   - Outside 7 days → offer to cancel at period end with no refund, OR a partial goodwill refund if the situation warrants.
4. Process the refund:
   - **Stripe Dashboard** → Payments → search by email or charge ID → click charge → Refund.
   - Optionally cancel subscription at the same time.
5. Add note in Stripe Dashboard customer notes: "Refund — reason: [X]."
6. Email customer confirming refund + ETA (5–10 business days).

## Workflow: chargeback dispute

If a chargeback comes through Stripe (status: "needs_response"):

1. **Don&apos;t panic.** Stripe gives you 7 days to respond.
2. Pull evidence:
   - Sign-up timestamp from Supabase
   - Subscription activation timestamp
   - Usage data (`audit_log` entries during the disputed period)
   - Login activity
3. Reach out to the customer directly first. Often the dispute is a "I forgot what this charge was" and they&apos;ll withdraw.
4. If they don&apos;t withdraw, decide:
   - **Accept the chargeback** if the customer has a legitimate complaint and the amount is small. Costs you ~$15 chargeback fee + the disputed amount.
   - **Dispute it** with the evidence above if you believe it&apos;s unfair.
5. Either way, suspend their account: `UPDATE organizations SET subscription_status='cancelled' WHERE id='...';`
6. Log it: more than 1% chargeback rate gets your Stripe account flagged. Watch this metric.

## Workflow: account deletion (GDPR / CCPA "right to be forgotten")

Manual process for now (automate later if needed):

1. Customer emails requesting deletion.
2. Verify identity (account email + a secondary signal like a phone match).
3. Cancel any active Stripe subscription (Stripe Dashboard → Customer → Cancel).
4. Offer a final data export (CSV downloads from `/accounting`).
5. After 30 days (cooling-off period), delete:
   ```sql
   -- Run as a service-role admin in Supabase SQL editor
   begin;

   -- Get the org_id
   with orgs as (
     select id from organizations where email = '<customer email>'
   )
   delete from organizations where id in (select id from orgs);
   -- Cascades to all dependent tables via ON DELETE CASCADE.

   -- Also delete the auth.users row
   delete from auth.users
   where id in (select id from profiles where /* TODO refine */ true);

   commit;
   ```
6. Confirm deletion to customer.
7. Note: Stripe records (charges, refunds) are retained per Stripe's policy for tax compliance.

**Backup window:** Supabase PITR (point-in-time recovery) means data is recoverable for 7 days even after a hard delete. After 7 days, it&apos;s gone.

## Workflow: voluntary cancellation due to non-use

Sometimes a customer hasn&apos;t logged in for 60+ days. Recommended retention play:

1. Email at day 30: "Haven&apos;t seen you in a month — any feedback?"
2. Email at day 60: "Still paying but not using. Want a pause instead?"
3. Pause option: SQL-update them to `subscription_status='cancelled'` + refund the current month as goodwill.

This converts dormant payers into happy alumni who might come back.

## Tracking refunds + cancellations

Add a quarterly review:
- Total refunded in $ and % of MRR
- Cancellation reasons (categorize)
- Churn rate

Build the queries in `docs/HANDOFF.md`. At 100 customers, set up Stripe Sigma
or a Metabase dashboard ($25/mo) so you don&apos;t need to run SQL.

## Refund authority

- **You (founder):** unlimited refund authority.
- **Future support staff:** authority up to 1 month of subscription value. Anything larger requires founder approval.

Document this so future hires know.
