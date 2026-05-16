# Documentation index

Everything you need to operate Suds, organized by purpose.

## Operational runbooks

When something happens, here&apos;s what to do:

| Process | Document |
| --- | --- |
| New customer onboarding | [`operations/01-customer-onboarding.md`](operations/01-customer-onboarding.md) |
| Support tickets | [`operations/02-support-tickets.md`](operations/02-support-tickets.md) |
| Refunds & cancellations | [`operations/03-refunds-cancellations.md`](operations/03-refunds-cancellations.md) |
| Failed payments (dunning) | [`operations/04-failed-payments-dunning.md`](operations/04-failed-payments-dunning.md) |
| Deployment | [`operations/05-deployment.md`](operations/05-deployment.md) |
| Database backups | [`operations/06-database-backups.md`](operations/06-database-backups.md) |
| Incident response | [`operations/07-incident-response.md`](operations/07-incident-response.md) |
| Billing & Stripe workflows | [`operations/08-billing-stripe-workflow.md`](operations/08-billing-stripe-workflow.md) |
| Email & SMS deliverability | [`operations/09-deliverability.md`](operations/09-deliverability.md) |
| Feature requests & roadmap | [`operations/10-feature-requests-roadmap.md`](operations/10-feature-requests-roadmap.md) |

## System guides

How specific systems work:

| Topic | Document |
| --- | --- |
| SaaS subscription billing | [`BILLING.md`](BILLING.md) |
| Testing strategy | [`TESTING.md`](TESTING.md) |
| Monitoring & on-call | [`MONITORING.md`](MONITORING.md) |
| Handoff / acquisition readiness | [`HANDOFF.md`](HANDOFF.md) |

## Legal templates

Documents to take to a lawyer for review before publishing:

| Document | Source / Page |
| --- | --- |
| Terms of Service | `src/app/legal/terms/page.tsx` → live at `/legal/terms` |
| Privacy Policy | `src/app/legal/privacy/page.tsx` → live at `/legal/privacy` |
| Data Processing Addendum | `src/app/legal/dpa/page.tsx` → live at `/legal/dpa` |
| SMS Consent & Messaging Policy | `src/app/legal/sms-consent/page.tsx` → live at `/legal/sms-consent` |
| Refund Policy | `src/app/legal/refund/page.tsx` → live at `/legal/refund` |
| Acceptable Use Policy | `src/app/legal/acceptable-use/page.tsx` → live at `/legal/acceptable-use` |
| Subprocessors list | `src/app/legal/subprocessors/page.tsx` → live at `/legal/subprocessors` |
| Contractor IP Agreement (internal) | [`legal/contractor-ip-agreement.md`](legal/contractor-ip-agreement.md) |
| Trademark filing guide | [`legal/trademark-filing.md`](legal/trademark-filing.md) |

## Quick reference for common situations

- **&quot;A customer&apos;s payment failed.&quot;** → `operations/04-failed-payments-dunning.md`
- **&quot;A customer wants to cancel.&quot;** → `operations/03-refunds-cancellations.md`
- **&quot;The site is down.&quot;** → `operations/07-incident-response.md`
- **&quot;I want to deploy a feature.&quot;** → `operations/05-deployment.md`
- **&quot;I&apos;m hiring a contractor.&quot;** → `legal/contractor-ip-agreement.md`
- **&quot;I need to write a privacy policy.&quot;** → start with `/legal/privacy` source; take to a lawyer.
- **&quot;A customer asked about SMS.&quot;** → point them at `/legal/sms-consent`.
- **&quot;Selling the company.&quot;** → `HANDOFF.md`

## Convention

- All documents end with no trailing blank lines.
- Use placeholders like `[STATE]`, `[LEGAL ENTITY NAME]` for anything you need to fill in.
- Update timestamps when you edit a legal document.
- Operational docs should be living — update them after each incident.
