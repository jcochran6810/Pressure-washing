# Incident response

What to do when something is broken in production.

## Definition of an incident

An incident is anything affecting customers:

- Site is down or returning errors
- Payments not processing
- Emails / SMS not sending
- Data appears corrupted or wrong
- Security breach (real or suspected)

Bugs that affect only one customer aren&apos;t incidents — they&apos;re support tickets.

## Severity

| Severity | Description | Response time | Examples |
| --- | --- | --- | --- |
| **SEV-1** | All customers affected, no workaround | Immediate (drop everything) | App is 500-ing globally, payments not processing |
| **SEV-2** | Most customers affected, or critical feature broken | Within 1 hour | SMS sending fails for all, login broken for ~50% |
| **SEV-3** | Subset of customers affected, OR non-critical feature broken | Within 4 hours | Calendar drag-and-drop doesn&apos;t work in Safari |
| **SEV-4** | Edge case or visual glitch | Next business day | Wrong icon in nav, typo in email template |

## The 5 steps when an incident starts

```
1. ACKNOWLEDGE  → 2. INVESTIGATE  → 3. MITIGATE  → 4. RESOLVE  → 5. POSTMORTEM
```

### 1. Acknowledge (within 5 minutes of alert)

- Alert sources: UptimeRobot SMS, Sentry email, customer ticket, Vercel deployment failure.
- Acknowledge the alert (UptimeRobot has an "ack" button).
- Set a status in your head: "incident is happening." Don&apos;t commit code, don&apos;t answer email, focus on this.

### 2. Investigate (5–30 minutes)

Pull up these tabs:

1. **Vercel Dashboard** → Logs (last 10 min)
2. **Sentry** → Issues (filter to last hour)
3. **Supabase Dashboard** → Reports → CPU, connections, slow queries
4. **Stripe Dashboard** → Developers → Events (any webhook failures?)
5. **Service status pages** — Vercel, Supabase, Stripe, Resend, Telnyx

Form a hypothesis: what broke and when? The most common cause is "the last deploy."

### 3. Mitigate (immediately, even before root cause)

Restore service first, debug later.

- **Last deploy is the culprit?** → Vercel Promote previous deployment. Site restored in 30s.
- **Supabase is the culprit?** → Wait. Post a status update if you have one. Cannot fix from your side.
- **Stripe webhook backlog?** → Don&apos;t intervene; Stripe will retry. Don&apos;t replay events manually unless idempotency is confirmed.
- **One feature broken?** → Disable it via a feature flag (TODO — add a feature flag system) or a quick code patch.
- **Database query running away?** → Cancel via Supabase Dashboard → Database → Active queries.
- **Surge traffic?** → Vercel auto-scales. If it&apos;s actually too much: temporarily restrict signups via maintenance banner.

### 4. Resolve (after mitigation)

- Find the root cause if you didn&apos;t already.
- Write a fix.
- Test on preview.
- Merge to main → deploys to prod.
- Confirm metrics return to normal.

### 5. Postmortem (within 48 hours)

For SEV-1 and SEV-2:
- What happened? (timeline)
- Why did it happen? (5 whys)
- What did we do to fix it?
- What will we do to prevent it next time?
- What action items, who owns each, by when?

Add postmortems to `docs/postmortems/YYYY-MM-DD-description.md`.

For SEV-3 and SEV-4: just a GitHub issue or commit message is fine.

## Communication during an incident

| Audience | When | How |
| --- | --- | --- |
| **You** | Immediately | Mental note |
| **Affected customers** | Within 30 min for SEV-1; within 2 hours for SEV-2 | Email or in-app banner |
| **All customers** | After resolution if SEV-1 lasted > 15 min | Email |
| **Public status page** | Always (eventually — see below) | Update status |

Templates:

### SEV-1 customer email (during)
> Subject: Suds is currently experiencing issues
>
> We&apos;re aware of an issue affecting [DESCRIPTION] and are working on a fix.
> Your data is safe. We&apos;ll update you within the hour. Thanks for your patience.

### SEV-1 customer email (post-resolution)
> Subject: Resolved — earlier issue with [DESCRIPTION]
>
> The issue with [X] from [TIME] to [TIME] is now resolved. Cause: [BRIEF, NON-TECHNICAL].
> What we&apos;re doing to prevent it: [BRIEF]. If you experienced data loss or
> incorrect charges, reply directly and we&apos;ll make it right.

## Public status page (add at ~100 customers)

Until then: in-app banner on outage.

Recommended provider: **Statuspage** by Atlassian ($29/mo), **Better Stack**
($24/mo), or DIY at status.yourdomain.com with a simple Next.js page that
reads from your monitoring.

Status page tells customers what&apos;s wrong without them needing to email you.

## Security incidents

Different playbook. If you suspect a security breach (data exfiltration, unauthorized access, credential leak):

1. **Don&apos;t panic. Don&apos;t delete logs.**
2. Rotate credentials: Supabase service role key, Stripe API keys, all third-party API keys.
3. Revoke any compromised sessions (Supabase Auth → Users → Revoke sessions).
4. Identify the scope: which customers, what data?
5. Notify affected customers within 72 hours (legal requirement under most privacy laws).
6. Preserve evidence: don&apos;t modify logs, take snapshots of relevant data.
7. Engage a security professional if the breach is material.
8. File required notifications (state AGs, GDPR DPA if EU customers affected).
9. Write a thorough postmortem and publish it (transparency builds trust).

For small breaches that affect one customer (e.g., they got phished), focus on
helping that customer recover without raising broader alarm.

## After-hours coverage

You&apos;re the only on-call right now. When you hire:

- Primary: highest-paid full-time technical person.
- Secondary: founder (you).
- Schedule rotations via PagerDuty ($21/user/mo) or Better Stack on-call ($25/mo).

## What to do if you can&apos;t fix it yourself

You will hit problems you can&apos;t solve. When that happens:

1. **Vercel:** open a support ticket; they answer in hours during business hours, days on weekends.
2. **Supabase:** open a support ticket; Pro plan gets faster response.
3. **Stripe:** chat support is 24/7 and excellent.
4. **Twitter/X:** posting at @Vercel, @supabase, @stripe with details often gets a response within hours from engineering.

Don&apos;t burn hours trying to debug an upstream provider issue. Escalate.

## Practice it

Once a quarter, run a "fire drill":
- Roll back to a previous Vercel deployment intentionally
- Time how long it takes you to notice + roll forward
- Note what was confusing
- Update this doc

Easier to practice the script when nothing is actually on fire.
