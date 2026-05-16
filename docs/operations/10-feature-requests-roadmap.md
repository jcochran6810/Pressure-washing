# Feature requests & roadmap management

How customer feature requests are captured, prioritized, and turned into shipped features.

## Where requests come from

| Source | Frequency | Quality |
| --- | --- | --- |
| Support emails | Most common | High — customer hits a real wall |
| In-app feedback (TODO add this) | Future | Medium |
| Twitter / forums / Reddit | Occasional | Low — drive-by complaints |
| Your own use of the product | Always | Highest — you feel the pain |
| Sales conversations | Occasional | High — but biased toward enterprise needs |

## Where to record them

**Today (small scale):** a GitHub Issues project called "Roadmap" in this repo.

Labels:
- `type:feature` — new functionality
- `type:enhancement` — improve existing
- `type:bug` — broken behavior
- `priority:p0` `priority:p1` `priority:p2` `priority:p3`
- `size:small` (< 1 day) `size:medium` (1–3 days) `size:large` (> 3 days)
- `area:invoices`, `area:billing`, `area:sms`, etc.

**When you outgrow Issues (~customer 100):** move to **Linear** ($8/user/mo) or **Productboard**.

## How to handle a request when it comes in

```
1. Capture the request in GitHub Issues.
   Title: short, action-oriented ("Allow editing line item descriptions after sending")
   Body:
     ## Who asked
     - Customer Acme (paid, ~$50/mo). Said: "[their quote]"
     ## Problem
     [what they're actually trying to do]
     ## Suggested solution
     [their idea, if any]
     ## My take
     [your assessment]

2. Reply to the customer:
   "Thanks for the suggestion — I've added it to my roadmap as [issue #N].
    I'll let you know when it's shipped. Anything else?"

3. Once a week, triage new issues.
   Bulk-label them. Decide what's worth doing.
```

## Prioritization framework (RICE-lite)

Score each candidate feature on 4 dimensions, score them yourself in 30 seconds:

| Dimension | Scale | Question |
| --- | --- | --- |
| **Reach** | 1–10 | How many customers does this affect? |
| **Impact** | 1–5 | How much does it improve their experience or save them time? |
| **Confidence** | 1–3 | How confident am I that this is the right solution? |
| **Effort** | 1–10 | Days of work (lower = better) |

Score = (Reach × Impact × Confidence) / Effort. Sort descending.

Don&apos;t over-engineer this. It&apos;s a tiebreaker, not the decision.

## What to build vs. what to decline

### Build

- Multiple customers have asked for the same thing
- It unlocks revenue (new paid feature, removes a churn reason)
- It removes recurring support load
- It&apos;s small (< 1 week) and obviously useful
- It&apos;s a "platform" capability others can build on (better APIs, etc.)

### Decline (or "not yet")

- Only one customer asked, and they aren&apos;t paying enough to justify
- It would only work for their specific niche
- It&apos;s a workflow change that conflicts with how the rest of the product works
- It would add ongoing maintenance burden disproportionate to its value
- It&apos;s "platform pivot" sized (e.g., "rewrite everything for mobile-first")

### Politely decline template

> Thanks for the idea — I&apos;m going to pass on this one for now. The reason: [BRIEF]. I&apos;ve noted it in case the situation changes. In the meantime, here&apos;s a workaround: [WORKAROUND]. Let me know if that helps.

Customers respect "no" more than "maybe later" that never resolves.

## Roadmap cadence

### Weekly
- Triage new issues (15 min Monday).
- Pick what to work on this week.

### Monthly
- Review what shipped vs. plan.
- Email customers a digest of new features (high engagement, low effort).
- Review the backlog — close stale issues (> 6 months untouched, no traction).

### Quarterly
- Strategic review: what big bets are we considering?
- Set 3–5 themes for the next quarter (e.g., "Q2 theme: deliverability improvements").

## Communicating the roadmap

### Public (after ~50 customers)

- Public board on Trello / Productboard / GitHub Discussions / Canny ($79/mo).
- Customers can vote on requests.
- High requests get prioritized.
- "Roadmap" page on your marketing site links to it.

This is intentionally transparent — customers love seeing their request gain traction.

Don&apos;t put dates on public roadmap items. You&apos;ll be wrong.

### Private (initially)

GitHub Issues, not visible to customers. Reply individually to feature requesters when their thing ships.

## When you ship a feature

1. Merge to main.
2. If customer-facing, email the requesters: "You asked for X — it shipped today. Here&apos;s how to use it: [link or screenshot]."
3. Add to your `CHANGELOG.md` (or future /changelog page).
4. Once a month, batch into a "what&apos;s new" email to all customers.
5. Optional: post on X / LinkedIn for marketing.

## Killing features

It&apos;s OK to remove features that aren&apos;t used. Process:

1. Check usage (audit log, page analytics).
2. If < 1% of customers use it: announce deprecation.
3. 30-day notice via email + in-app banner.
4. Provide a migration path (if relevant).
5. Remove the code.

Less code = less maintenance = faster shipping of what matters.

## The "I want to build everything" trap

At any time you&apos;ll have 50+ ideas. You can build 1–2 per week. That means:

- Most ideas will never be built. That&apos;s OK.
- Pick ones that matter most. Cut ruthlessly.
- "Important and urgent" gets built first. "Important and not urgent" is the second priority. "Urgent and not important" is the trap.

## When to hire

Decision rule for hiring a developer:
- Your backlog has > 6 months of features customers are actively requesting
- You&apos;re working 50+ hours and the limiting factor is dev capacity (not sales)
- You can afford $80K–$140K/year all-in (US developer, fully loaded)

Until then: ship what you can, decline gracefully, focus on revenue.
