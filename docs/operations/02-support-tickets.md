# Support tickets

How customer support issues get triaged, prioritized, and resolved.

## Current setup (lightweight; appropriate up to ~100 customers)

Support email: **support@yourdomain.com** → forwards to your inbox.

No ticketing system yet. Use Gmail / Apple Mail / Fastmail labels:
- `support/open` — actively working
- `support/waiting-on-customer` — replied, awaiting their response
- `support/done` — resolved, archived

## When to upgrade to a real ticketing system

Migrate to **Help Scout** ($25/mo) or **Plain** ($25/mo per user) when:
- You're handling more than 10 tickets per week, OR
- You hire your first support person, OR
- You're losing tickets in email threads

## Priority triage

| Priority | Definition | Target response | Examples |
| --- | --- | --- | --- |
| **P0 — critical** | Service is down or a customer can&apos;t access their data | Within 1 hour | App is 500-ing for everyone, billing failed at scale, customer can&apos;t log in |
| **P1 — high** | Major feature broken, blocking customer&apos;s business | Within 4 hours | Stripe webhook not recording payments, SMS not sending |
| **P2 — normal** | Bug or how-to question | Within 1 business day | "How do I change my invoice prefix?", visual glitch |
| **P3 — low** | Feature request, suggestion | Within 1 week | "Could you add X?" |

## Standard responses (save these as Gmail snippets / Help Scout saved replies)

### "How do I update my payment method?"
> Hi [name], you can update your card in Settings → Billing → "Manage payment method." That opens the Stripe customer portal where you can swap the card. Let me know if you hit anything weird!

### "I was charged but my account is still in trial mode"
> Hi [name], thanks for the heads up — the subscription webhook usually flips it in under 30 seconds. Could you reload /billing once and let me know if the status changed? If it's still showing trial after that, send me your account email and I'll fix it manually.

### "Can you give me a refund?"
> Hi [name], absolutely — I've processed the refund just now. It usually takes 5–10 business days to show up on your statement depending on your bank. Anything we could have done differently? Always interested in feedback.

(Then actually process the refund in Stripe Dashboard → Customers → find them → Refund.)

### "I want to delete my account / data"
> Hi [name], no problem. I&apos;ll cancel your subscription and trigger a data deletion. Just to confirm: this permanently removes all customers, jobs, invoices, and uploaded photos after 90 days. Would you like me to send you a CSV export of everything first? It takes about 5 minutes.

### "I can't send SMS — TCPA / 10DLC error"
> Hi [name], that's a registration thing — US carriers require business SMS to be registered under 10DLC. Walkthrough: [link to /legal/sms-consent#10dlc]. Once approved (1–3 days), you'll be able to send. Telnyx support is great if you get stuck on a specific step.

### "Where's my receipt for the [date] charge?"
> Hi [name], all your subscription invoices live in Stripe's customer portal. Settings → Billing → Manage payment method opens that up. Let me know if you can&apos;t find a specific one.

## Escalation path

Bug that requires code change:
1. Reproduce locally with a test account.
2. Create GitHub issue with steps, expected behavior, actual behavior.
3. Tag with severity.
4. Reply to customer: "I&apos;ve reproduced this — tracking as bug [#123]. Will follow up when fixed, ETA [date]."
5. Fix → deploy → close issue → email customer.

Billing dispute that customer pushes back on:
1. Pull the full Stripe charge history.
2. Pull the audit log for that org.
3. Explain in plain language what the charges were for.
4. If you can&apos;t resolve, offer a refund as a goodwill gesture rather than fighting it.

## Metrics to track (quarterly)

- Ticket volume per week
- Median first-response time
- Median time-to-resolution
- CSAT (ask "rate this response 1-5" in your reply signature)
- Tickets by category (billing, bug, how-to, feature request)

A spreadsheet works fine until 100 tickets/week.

## After-hours coverage

Currently: nights and weekends are "best effort." Document this in your /support
page or signup welcome email so expectations are set.

When to add 24/7 coverage: once payment failures or outages would cost more
than the support contractor. Roughly $5K MRR. Consider Boldr, Influx, or
Partnerhero for outsourced first-line support starting at ~$3K/month.
