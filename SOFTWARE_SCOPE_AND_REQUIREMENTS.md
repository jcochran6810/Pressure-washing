# Suds — Software Scope of Work & Requirements Specification

**Project:** Suds — Pressure Washing Business Manager
**Repository:** `jcochran6810/pressure-washing`
**Branch analyzed:** `claude/create-scope-requirements-doc-qunv7`
**Document version:** 1.0
**Document date:** 2026-05-12
**Audience:** Business / pricing analyst preparing valuation, pricing tiers, and go-to-market estimates.
**Codebase footprint analyzed:** ~90 TypeScript/TSX files, ~24 Postgres tables, Next.js 14 App Router, Supabase backend.

> The document below is sourced **directly from the current codebase** (`/src`, `package.json`, `README.md`, `.env.local.example`, and database type definitions in `src/lib/types/database.ts`). Anything described as "currently exists" was verified in the source files. Anything described as "planned" or "missing" is either an explicit TODO in the code, an obvious gap (UI button with no backend, schema field with no UI, etc.), or an industry-standard expectation for the product category.

---

## 1. Executive Summary

**Suds** is an all-in-one, browser-based business operating system built specifically for **pressure washing companies** (residential and commercial soft wash / power wash operators). It bundles the operational toolset that a pressure washing business currently has to assemble from 5–8 disconnected products (CRM, scheduling, estimating, invoicing, payments, accounting, chemical inventory, marketing) into a single multi-tenant SaaS application.

**The core problem it solves:** small-to-mid-sized pressure washing operators run their business across paper notebooks, group texts, spreadsheets, Square invoices, QuickBooks, Google Calendar, separate review-request services, and a phone full of before/after photos. Quotes get delayed, customers don't pay on time, jobs get double-booked, chemical inventory runs out mid-job, and reviews never get asked for.

**Why someone would pay for it:**
- Replaces 5–8 separate paid SaaS subscriptions with one bill.
- Industry-specific from the ground up (sqft pricing on satellite imagery, SH/surfactant mix calculator, hazard-class chemical tracking, height/material modifiers) — generic tools (Jobber, Housecall Pro, ServiceTitan) are either too generic or built for plumbers/HVAC and overcharge for pressure washing use cases.
- A guided **end-to-end workflow stepper** that takes the owner from estimate → digital quote approval → scheduling → job start → photos → invoice → Stripe payment → emailed receipt → review request, with one button per step.
- Mobile-friendly so a sole-operator owner-operator can run the whole business from their phone in the truck.

**Maturity:** Mid-stage MVP. The "money path" (customer → estimate → job → invoice → payment → receipt) is functionally complete and integrated with Stripe and Resend. Several modules (chemicals, equipment, leads, marketing campaigns, satellite measurement) are implemented but at a v1 depth. Crew/dispatch, payroll, route optimization, native mobile, and offline support are absent.

---

## 2. Target Customers / Users

### 2.1 Primary customers (paying)
| Segment | Profile | Why they buy |
| --- | --- | --- |
| **Solo owner-operator** | 1 person, $30–150K/yr revenue, runs everything from a truck | Replaces paper, Jobber Lite, Square, Google Sheets. Wants to look professional and stop forgetting jobs. |
| **Small crew operator** | Owner + 1–4 field technicians, $150–500K/yr | Needs scheduling, route awareness, crew assignment, customer database, invoicing on the spot, accounting visibility. |
| **Established small business** | $500K–$2M/yr, 2–4 trucks, 1 office person | Replaces a stack: QuickBooks + Jobber + Mailchimp + Podium + Google Drive. Wants dashboards, marketing ROI, deposits, recurring service reminders. |
| **Commercial / HOA contractor** | Recurring contracts, multiple properties per account | Needs property records per customer, recurring reminders, tax-deductible expense tracking, P&L by quarter. |

### 2.2 Users inside the customer's organization
| Role | Currently in code | Description |
| --- | --- | --- |
| Business Owner / Account Owner | Yes (default `owner` role on `organization_members`) | Full access to everything in the org. |
| Office / Dispatcher | Schema-ready (role field exists) but no permission separation in code | Would create estimates, schedule jobs, send invoices, take payments. |
| Field Crew / Technician | Job assignments table exists (`job_assignments`); no separate UI yet | Should view assigned jobs, log start/complete, upload before/after photos, mark a chemical used. |
| Manager | Not yet implemented | Should view all crews, dashboards, P&L, but not edit settings. |

### 2.3 External / non-paying users
| Role | Currently in code | Description |
| --- | --- | --- |
| End customer (homeowner / property manager) | Yes — token-scoped public pages | Receives estimate via email, approves/declines on `/quote/<token>`; receives invoice + Stripe link; views before/after gallery on `/gallery/<token>`; rates service on `/review/<token>`. |
| Lead (web visitor) | Schema-ready (lead form exists internally; no public landing page yet) | Would submit an inbound web lead form. |
| Super Admin (Suds platform staff) | **Not implemented** | Would view all orgs, billing, support, troubleshoot. |

### 2.4 Customer segments most likely to convert
1. Owner-operators who currently invoice via Square or Venmo and are losing deals because they look unprofessional.
2. 2–3 truck operators paying for Jobber/Housecall Pro and frustrated by missing pressure-washing-specific features (mix calculator, sqft-on-satellite, SH inventory).
3. New entrants searching for "pressure washing software" before launching their first season.

---

## 3. Core Value Proposition

### 3.1 Pain points solved
| Pain | How Suds addresses it |
| --- | --- |
| Quotes lost in text-message threads | Estimates with `approval_token` create a one-click `/quote/<token>` page with digital signature. Status auto-updates, an open job is auto-created on approval, and a follow-up flag appears on the dashboard if 3+ days pass without action. |
| Owners forget to invoice after a completed job | Marking a job "completed" auto-drafts an invoice from the linked estimate's line items. |
| Slow/no payment | Stripe payment link is auto-generated on send. The Stripe webhook auto-records the payment and stamps the invoice PAID. A receipt is emailed automatically. |
| No customer reviews on Google | After payment, an automatic review request email goes out. Internal smart router: 1–3 stars stay private (so the owner can fix), 4–5 stars push the customer to the org's Google review URL. |
| Spreadsheet-based pricing | Service catalog with per-unit pricing (flat / sqft / linear ft / hour / each), per-material modifiers (concrete vs. brick vs. wood…), height-per-story modifiers, per-service min charge, global min job total, deposit threshold, deposit %. |
| Estimating from a desk by guessing sqft | `/measure` satellite tool: search the address, draw polygons on Google hybrid imagery, tag each with material + service, total sqft auto-computed. Polygons can be re-attached to a property and reused. |
| Running out of SH/surfactant mid-job | Chemicals inventory with `current_stock`, `reorder_level`, low-stock dashboard alert, transaction log (purchase / usage / waste / adjustment), SDS link, supplier, hazard class. |
| Not knowing if the business is profitable | `/reports` page builds a real P&L from `payments` and `expenses` for any period (this month, last month, quarter, YTD, last 12 months), plus revenue-vs-expense bar chart for last 6 months and a vendor/method breakdown. |
| Photos lost on the owner's phone | In-app `PhotoUploader` writes to Supabase Storage with kind tagging (before/after/damage/reference). Token-scoped public `/gallery/<token>` page lets the owner share a polished before/after page with the customer. Optional Save-to-Drive uploads documents to the org's connected Drive folder. |
| Re-typing customer info into 4 systems | Single source of truth: a customer has properties → estimates → jobs → invoices → payments, all linked. |

### 3.2 Time / money saved (estimated)
- **5–8 SaaS subscriptions consolidated.** Industry stack typically costs $200–$700/month combined (Jobber $79–$249, QuickBooks $30–$200, Square fees, Podium $300+, Mailchimp $20+).
- **30–60 min/day of admin** (manual quoting, manual invoicing, manual payment tracking, manual receipts, manual review asks).
- **3–8 percentage points of collection rate** because Stripe link + automatic receipt cuts payment delays.

### 3.3 Why better than alternatives
| Alternative | Why Suds wins |
| --- | --- |
| Spreadsheets / paper / texts | Auto-billing, digital approval, persistent customer history. |
| Square + QuickBooks + Google Calendar | Linked workflow, single data model, no double-entry. |
| Jobber / Housecall Pro | Pressure-washing native (mix calculator, satellite measure, SH inventory, height modifiers). Cheaper if priced under their $79+ entry tier. |
| ServiceTitan | Drastically simpler/cheaper; no enterprise complexity. |

### 3.4 What is NOT a strength (yet)
- No native iOS / Android app; mobile is responsive web only.
- No offline support — a crew without signal cannot record work.
- No route optimization or dispatch board.
- No payroll or 1099 reporting.
- No two-way SMS conversation.

---

## 4. Current Feature Inventory

> Status legend: **Complete** = working end-to-end. **Partial** = working but missing common cases. **Prototype** = working but unpolished or limited. **Placeholder** = UI exists with mock or no backend. **Missing** = referenced but not implemented.

### 4.1 Authentication & Multi-tenancy
| # | Feature | Description | Role | Status | Value | Complexity | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Email/password sign-up | Supabase auth, creates profile + organization + default services on signup via DB trigger `handle_new_user()`. | Owner | Complete | Foundation | Low | `src/app/(auth)/signup/page.tsx` |
| 2 | Email/password login | Supabase session cookies, year-long max age. | All | Complete | Foundation | Low | |
| 3 | Anonymous demo mode | "Try the demo" creates anon Supabase session and seeds realistic data via `seedDemoData()`. | Visitor | Complete | Sales/marketing | Medium | Requires Supabase anonymous auth enabled. `src/app/(auth)/demo/actions.ts` |
| 4 | Multi-org membership | `organization_members` table with `role` field. | All | Partial | Foundation | Medium | Roles defined in schema but not enforced in app code. |
| 5 | Row-Level Security | Every query filtered by `organization_id` via `is_org_member()` Postgres function. | All | Complete | Critical security | High | Documented in README. |
| 6 | Token-refreshing middleware | Silent session refresh on every request. | All | Complete | UX | Low | `src/middleware.ts`, `src/lib/supabase/middleware.ts` |
| 7 | Sign out | Server route `/auth/signout`. | All | Complete | Foundation | Low | |
| 8 | Email confirmation flow | Supabase callback at `/auth/callback`. | All | Complete | Foundation | Low | |

### 4.2 Dashboard
| # | Feature | Description | Role | Status | Value | Complexity | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 9 | KPI strip | Revenue MTD, Expenses MTD, Profit MTD, A/R outstanding. | Owner | Complete | High | Low | `src/app/(app)/dashboard/page.tsx` |
| 10 | Action items strip | Unpaid invoices, overdue, follow-up estimates, draft estimates, new leads. | Owner | Complete | High | Low | |
| 11 | This week's jobs | Next 7 days of scheduled jobs. | Owner | Complete | High | Low | |
| 12 | Outstanding invoices list | Top 5 by due date. | Owner | Complete | High | Low | |
| 13 | Estimates needing follow-up | Sent ≥ 3 days ago without response. | Owner | Complete | High | Low | |
| 14 | Recent leads | Most recent 5. | Owner | Complete | Medium | Low | |
| 15 | Low-stock alerts | Chemicals at or below reorder level. | Owner | Complete | High | Low | |
| 16 | Equipment service due | Equipment with `next_service_date` ≤ 14 days away. | Owner | Complete | Medium | Low | |

### 4.3 Customers & Properties (CRM)
| # | Feature | Description | Role | Status | Value | Complexity | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 17 | Create / edit / delete customer | Residential or commercial; first/last name OR company; phone, mobile, email, lead source, notes, tags. | Owner | Complete | Critical | Low | `customers/actions.ts` |
| 18 | Quick-create customer | One-shot create from inside other forms. | Owner | Complete | UX | Low | `customers/quick-actions.ts` |
| 19 | Search customers | Search by name/email/phone (UI present). | Owner | Complete | High | Low | |
| 20 | Add multiple properties per customer | Address, nickname, sqft, stories, gate code, lat/lng. | Owner | Complete | Critical | Low | |
| 21 | Customer detail page | Shows contact, properties, related estimates/jobs/invoices, "+ Estimate / + Job / + Invoice" quick-actions, "Measure on map" link per property. | Owner | Complete | Critical | Medium | `customers/[id]/page.tsx` |
| 22 | Tags array | Free-form tags column on `customers`. | Owner | Partial | Medium | Low | Schema has it; no UI to filter by tag yet. |
| 23 | Lead source on customer | Free-text field. | Owner | Complete | Medium | Low | |

### 4.4 Estimates
| # | Feature | Description | Role | Status | Value | Complexity | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 24 | Create estimate | Customer + property + line items + tax + discount + notes + terms. | Owner | Complete | Critical | Medium | `estimates/actions.ts` |
| 25 | Auto-numbering | `EST-####` from `organizations.next_estimate_number`. Configurable prefix. | Owner | Complete | High | Low | |
| 26 | 30-day default expiry | Auto-calculated. | Owner | Complete | Medium | Low | |
| 27 | Internal duration + buffer | `duration_minutes`, `buffer_minutes` for capacity planning. | Owner | Complete | Medium | Low | |
| 28 | Global minimum job total | Auto-rounds up to org's `global_min_job_price`. | Owner | Complete | Medium | Medium | |
| 29 | Auto-deposit calculation | If total ≥ org's `deposit_threshold`, sets `deposit_amount = total × deposit_percentage`. | Owner | Complete | High | Low | |
| 30 | Per-line photo attachments | Line items support `photo_urls[]`. | Owner | Complete | Medium | Medium | |
| 31 | Send estimate via email | Resend-based, includes Print-styled HTML body. | Owner | Complete | Critical | Medium | |
| 32 | Save to Google Drive | Pushes HTML estimate into the org's `estimates/` Drive folder. | Owner | Complete | Medium | Medium | |
| 33 | Generate digital quote URL | `approval_token` UUID generates `/quote/<token>`. | Owner | Complete | Critical | Low | |
| 34 | Customer approval (public) | Public quote page with line items, signature input, approve/decline. | Customer | Complete | Critical | Medium | `quote/[token]/page.tsx`. Note: requires DB RLS policy or RPC `accept_estimate_by_token`. |
| 35 | Customer decline (public) | With optional reason. | Customer | Complete | Medium | Low | |
| 36 | Convert estimate → invoice | Creates linked invoice with copied line items, marks estimate `converted`, ensures a completed-job exists in between. | Owner | Complete | Critical | Medium | |
| 37 | Print-friendly HTML | Served from `/api/documents/estimates/[id]/pdf` (HTML, not real PDF). | Owner/Customer | Partial | High | Low | Path is named "pdf" but returns HTML. |

### 4.5 Jobs / Field Operations
| # | Feature | Description | Role | Status | Value | Complexity | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 38 | Create / edit / delete job | Title, description, scheduled start/end, total amount, status. | Owner | Complete | Critical | Medium | `jobs/actions.ts` |
| 39 | Job statuses | scheduled → in_progress → completed (+ implicit cancelled). | Owner | Complete | Critical | Low | |
| 40 | Auto-record actual_start / actual_end | When status changes to in_progress / completed. | Owner | Complete | Medium | Low | |
| 41 | Auto-draft invoice on completion | From linked estimate (preferred) or from job total. | Owner | Complete | Critical | Medium | |
| 42 | Schedule appointment reminder | When job is scheduled, queues a `customer_reminders` row at org's `appointment_reminder_hours` lead time (default 24h). | Owner | Complete | High | Medium | |
| 43 | Re-schedule job | Cleans the old reminder, schedules a new one. | Owner | Complete | High | Medium | |
| 44 | Job assignments to crew | `job_assignments` table; no UI to assign yet. | — | Partial | High | Medium | Schema-only. |
| 45 | Per-job photos | `before_photos[]` and `after_photos[]` on job + `photo_attachments` table. | Owner | Complete | High | Medium | |
| 46 | PhotoUploader component | Direct upload to Supabase Storage `photos` bucket, signed URL valid 1 yr, kind selector (before/after/damage/reference), camera capture on mobile. | Owner / Crew | Complete | High | Medium | `components/photo-uploader.tsx` |
| 47 | Generate before/after gallery link | Creates `public_galleries` row with random token → `/gallery/<token>` public page. | Owner | Complete | Medium (marketing) | Low | |
| 48 | Photo annotations | Schema-ready per README. | — | Missing UI | Medium | Medium | |

### 4.6 Calendar / Scheduling
| # | Feature | Description | Role | Status | Value | Complexity | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 49 | Week view calendar | 7-column day grid. | Owner | Complete | High | Low | `calendar/page.tsx` |
| 50 | Click into job from calendar | Yes. | Owner | Complete | High | Low | |
| 51 | Drag-and-drop rescheduling | **Missing** per README. Only re-schedule via job page. | — | Missing | High | Medium | |
| 52 | Day / Month view | Only week view exists. | — | Missing | Medium | Low | |
| 53 | Crew filter on calendar | **Missing** | — | Missing | Medium | Medium | |
| 54 | Google Calendar sync | **Missing** | — | Missing | High | High | |

### 4.7 Invoices
| # | Feature | Description | Role | Status | Value | Complexity | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 55 | Create / edit / delete invoice | Standalone or auto-from-job/estimate. | Owner | Complete | Critical | Medium | `invoices/actions.ts` |
| 56 | Auto-numbering | `INV-####` with configurable prefix. | Owner | Complete | High | Low | |
| 57 | Line items with photos | `invoice_line_items` + `photo_urls[]`. | Owner | Complete | Medium | Medium | |
| 58 | Tax + discount calculation | At org's tax rate. | Owner | Complete | Critical | Low | |
| 59 | Send invoice via email | Auto-creates Stripe payment link if missing, prepends "Pay invoice online" CTA, marks `sent`. | Owner | Complete | Critical | Medium | |
| 60 | Save invoice to Drive | HTML to org's `invoices/` Drive folder. | Owner | Complete | Medium | Medium | |
| 61 | Manual payment recording | Cash / check / card / ACH / other; updates `amount_paid`, `balance_due`, status. | Owner | Complete | Critical | Medium | |
| 62 | Stripe payment link generation | Creates products + prices + payment link via Stripe API; stored on invoice. | Owner | Complete | Critical | High | |
| 63 | Stripe webhook auto-payment | Listens for `checkout.session.completed`, inserts payment, stamps invoice paid. | System | Complete | Critical | High | `api/stripe/webhook/route.ts` |
| 64 | Auto-emailed receipt on payment | "PAID" stamped HTML receipt via Resend. Logs to `receipt_log`. | Owner | Complete | High | Medium | |
| 65 | Auto-review request after paid | Public `/review/<token>` page. 1–3 stars stay internal (`review_feedback`); 4–5 stars push to Google review URL. | Customer | Complete | High | Medium | |
| 66 | Auto-recurring service reminder | After paid, queues a `customer_reminders` row N months out (default 12). | Owner | Complete | Medium | Medium | |
| 67 | Print-friendly invoice HTML | `/api/documents/invoices/[id]/pdf`. | Owner/Customer | Partial | High | Low | Returns HTML, not real PDF. |
| 68 | Status enum | draft / sent / partial / paid / overdue. Filtering supported. | Owner | Complete | High | Low | |
| 69 | Receipt log audit | `receipt_log` records every receipt sent (provider, provider_id, status). | Owner | Complete | Compliance | Low | |

### 4.8 Payments
| # | Feature | Description | Role | Status | Value | Complexity | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 70 | Payments ledger view | All payments with date, customer, invoice, method, reference, amount. | Owner | Complete | High | Low | `payments/page.tsx` |
| 71 | Stripe-source identification | `payment_method = "stripe"` and stored payment-intent ID. | Owner | Complete | High | Low | |
| 72 | Refunds | **Missing** | — | Missing | High | Medium | |
| 73 | Partial payment / deposit handling | Status set to `partial`; balance tracked. | Owner | Complete | High | Low | |

### 4.9 Services & Pricing
| # | Feature | Description | Role | Status | Value | Complexity | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 74 | Service catalog CRUD | Per-org services. | Owner | Complete | Critical | Low | `services/page.tsx` |
| 75 | Pricing units | flat / sqft / linear_ft / hour / each. | Owner | Complete | High | Low | |
| 76 | Price per sqft & per linear ft | Numeric fields. | Owner | Complete | High | Low | |
| 77 | Per-service min charge | Numeric field. | Owner | Complete | Medium | Low | |
| 78 | Default duration | For internal capacity. | Owner | Complete | Medium | Low | |
| 79 | Height modifier per story | Default 15% per story. | Owner | Complete | Medium | Low | |
| 80 | Material modifiers | concrete/brick/stucco/vinyl/wood/composite/roof_shingle/roof_tile/pavers, each a multiplier (0.9 / 1.0 / 1.2…). | Owner | Complete | Medium | Medium | |
| 81 | Add-on flag | Mark service as a suggested add-on. | Owner | Complete | Medium | Low | |
| 82 | Active toggle | Soft-disable services. | Owner | Complete | Low | Low | |
| 83 | Global min job total | Org-level. | Owner | Complete | High | Low | |
| 84 | Deposit threshold + percentage | Org-level. | Owner | Complete | High | Low | |
| 85 | Auto-suggested line items based on measurement | **Missing** — measurement tool computes sqft but does not auto-build line items in the estimate form. | — | Partial | High | Medium | Workflow gap. |

### 4.10 Satellite Measurement
| # | Feature | Description | Role | Status | Value | Complexity | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 86 | Geocode address | Google Geocoding via input box. | Owner | Complete | High | Medium | `components/measurement-map.tsx` |
| 87 | Polygon drawing | Google Maps Drawing API on hybrid tiles. | Owner | Complete | High | High | |
| 88 | Auto sqft area calc | Google Geometry API spherical compute. | Owner | Complete | High | Low | |
| 89 | Per-polygon material + service tagging | Inline list editor. | Owner | Complete | High | Medium | |
| 90 | Save measurements to property | `measurements` table; auto-sets property GPS for future jobs. | Owner | Complete | Medium | Medium | |
| 91 | Pull existing measurements when revisiting a property | `?property=` query param re-loads. | Owner | Complete | Medium | Low | |
| 92 | Edit a saved polygon's vertices | Built into the drawing manager. | Owner | Complete | Medium | Medium | |
| 93 | Inline-from-estimate measurement | `MeasurementMap` re-used in `MeasurementModal`. | Owner | Partial | High | Medium | |

### 4.11 Chemicals & Mix
| # | Feature | Description | Role | Status | Value | Complexity | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 94 | Chemical CRUD | Brand, category, unit, cost/unit, supplier, SDS URL, hazard class. | Owner | Complete | Medium | Low | |
| 95 | Stock tracking | `current_stock`, `reorder_level`. | Owner | Complete | Medium | Low | |
| 96 | Transaction log | purchase / usage / waste / adjustment. | Owner | Complete | Medium | Medium | |
| 97 | Low-stock dashboard alert | Yes. | Owner | Complete | Medium | Low | |
| 98 | Mix calculator | UI page using `MixCalculator` and `chemical_recipes` table. | Owner | Complete | Industry-niche high | Medium | `mix/page.tsx` |
| 99 | Saved recipes | `chemical_recipes` table. | Owner | Partial | Medium | Medium | Schema and read; no clear save-from-calculator path verified. |
| 100 | Auto-deduct chemical from job | Schema has `chemical_transactions.job_id`; no UI flow. | — | Missing UI | Medium | Medium | |

### 4.12 Equipment
| # | Feature | Description | Role | Status | Value | Complexity | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 101 | Equipment CRUD | Type, serial, purchase, value, status (active/maintenance/retired), hours, next service date. | Owner | Complete | Medium | Low | |
| 102 | Service due dashboard alert | Equipment with `next_service_date` ≤ 14 days. | Owner | Complete | Medium | Low | |
| 103 | Hours-used tracking | Free-form numeric. | Owner | Partial | Medium | Low | No automatic increment. |
| 104 | Maintenance log | **Missing** — only single `last_service_date` / `next_service_date` fields. | — | Missing | Medium | Medium | |

### 4.13 Expenses & Accounting
| # | Feature | Description | Role | Status | Value | Complexity | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 105 | Expense CRUD | Vendor, category, amount, date, description, payment method, deductible flag, receipt URL, optional job link. | Owner | Complete | High | Low | |
| 106 | Expense categories | Per-org. Seeded on signup. | Owner | Complete | Medium | Low | |
| 107 | Filtering | Period chips (this month, last month, quarter, YTD, 12mo, all-time, custom range), category, search, deductible-only. | Owner | Complete | High | Medium | |
| 108 | Charts | Category distribution bar, 12-month trend, top vendors. | Owner | Complete | High | Medium | |
| 109 | KPIs | Total, average, deductible, receipts saved. | Owner | Complete | Medium | Low | |
| 110 | P&L statement | Revenue (by payment method) – Expenses (by category) = Net profit, with margin. | Owner | Complete | High | Medium | `reports/page.tsx` |
| 111 | 6-month revenue vs expense bar chart | Yes. | Owner | Complete | High | Medium | |
| 112 | Receipt upload | URL field + `receipt_log` for emails. There is also `lib/receipt-upload.ts` (62 lines). | Owner | Partial | Medium | Medium | UI path is "paste a URL"; no file upload from inside the form. |
| 113 | Mileage log | **Missing** | — | Missing | Medium | Medium | |
| 114 | Bank feed import / OCR receipts | **Missing** | — | Missing | High | High | |

### 4.14 Marketing & Leads
| # | Feature | Description | Role | Status | Value | Complexity | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 115 | Lead pipeline | new → contacted → quoted → won/lost (+ nurture). | Owner | Complete | High | Low | `leads/page.tsx` |
| 116 | Lead status advance buttons | One-click status moves. | Owner | Complete | Medium | Low | |
| 117 | Convert lead → customer | Yes. | Owner | Complete | High | Low | |
| 118 | Lead sources catalog | `lead_sources` table + `cost_per_month` field. Seeded on signup. | Owner | Complete | Medium | Low | |
| 119 | Campaign tracker | Name, channel, budget, spent, impressions, clicks, conversions, leads_generated, status. | Owner | Complete | Medium | Low | |
| 120 | Campaign progress bar | Spend vs budget. | Owner | Complete | Medium | Low | |
| 121 | Auto review request | Sent on payment if `review_request_enabled`. | System | Complete | High | Medium | |
| 122 | Smart review router | 1–3 stars stay private; 4–5 stars push to Google. | System | Complete | High | Medium | |
| 123 | Public lead capture form | **Missing** — there is no `/lead/new` public route. | — | Missing | High | Medium | |
| 124 | Email marketing campaigns | **Missing** — no bulk-send or template editor. | — | Missing | Medium | High | |
| 125 | SMS to leads | **Missing** | — | Missing | High | High | |

### 4.15 Reminders / Notifications
| # | Feature | Description | Role | Status | Value | Complexity | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 126 | Customer reminders queue | `customer_reminders` table with kind (`appointment`, `recurring_service`, `review_request`), channel (`email`), `scheduled_for`, `message`, `status`. | System | Complete | High | Medium | |
| 127 | Cron endpoint | `POST /api/cron/reminders` with `CRON_SECRET` Bearer token; sends due reminders via Resend in batches of 50. | System | Complete | High | Medium | |
| 128 | Per-org reminder lead times | `appointment_reminder_hours`, `recurring_reminder_months`. | Owner | Complete | High | Low | |
| 129 | SMS channel | Schema has `channel` field; only `email` implemented. | — | Missing | High | Medium | |
| 130 | In-app notifications | **Missing** | — | Missing | Medium | Medium | |
| 131 | Push notifications | **Missing** | — | Missing | Medium | High | |

### 4.16 Documents & Storage
| # | Feature | Description | Role | Status | Value | Complexity | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 132 | HTML invoice/estimate generator | `lib/document-html.ts`. | System | Complete | High | Medium | |
| 133 | PDF generation | **Missing** — routes are named `/pdf` but emit HTML. Browser print handles export. | — | Partial | High | Medium | |
| 134 | Google Drive OAuth | Full PKCE-style refresh-token flow. | Owner | Complete | Medium | High | `lib/google-drive.ts`, `api/google/connect`, `api/google/callback` |
| 135 | Drive folder per doc type | Auto-creates `invoices/`, `estimates/`, `photos/`, `receipts/` sub-folders. | Owner | Complete | Medium | Medium | |
| 136 | Drive uploader util | `lib/drive-uploader.ts`. | System | Complete | Medium | Medium | |
| 137 | Photo storage | Supabase Storage `photos` bucket, signed URLs (1 year). | Owner | Complete | High | Medium | |

### 4.17 Settings
| # | Feature | Description | Role | Status | Value | Complexity | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 138 | Business info | Name, address, phone, email, website, tax rate, currency. | Owner | Complete | Critical | Low | |
| 139 | Numbering prefixes | Invoice + estimate prefixes editable. | Owner | Complete | Medium | Low | |
| 140 | Reminders + reviews settings | Lead times + Google review URL + auto-request toggle. | Owner | Complete | High | Low | |
| 141 | Integration status panel | Stripe, Resend, Maps, Drive (configured / connected / not connected). | Owner | Complete | Medium | Low | |
| 142 | Logo upload | `logo_url` column exists; no upload UI verified. | — | Missing UI | Medium | Low | |
| 143 | Team management UI | **Missing** | — | Missing | High | Medium | |
| 144 | Custom email/SMTP / domain authentication | **Missing** | — | Missing | Medium | High | |

### 4.18 Workflow Stepper
| # | Feature | Description | Role | Status | Value | Complexity | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 145 | End-to-end stepper component | Estimate created → sent → accepted → job scheduled → started → completed → invoice draft → sent → paid → receipt sent. Each step shows done/current/pending. | Owner | Complete | **Differentiator** | High | `components/workflow-stepper.tsx` |
| 146 | Next-step banner | Big colored card on each detail page suggesting the next single action with a button. | Owner | Complete | **Differentiator** | High | `components/next-step-banner.tsx` |
| 147 | Cross-link estimate↔job↔invoice | Each entity remembers its predecessor. | Owner | Complete | High | Medium | |

### 4.19 Mobile UX
| # | Feature | Description | Role | Status | Value | Complexity | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 148 | Responsive layout | Sidebar on desktop, top bar + bottom tab bar on mobile. | All | Complete | High | Medium | |
| 149 | Camera capture for photos | `<input capture="environment" />`. | Crew | Complete | High | Low | |
| 150 | Mobile bottom nav | Home / Estimates / Jobs / Customers / Invoices. | All | Complete | High | Low | |
| 151 | Tap-to-call / tap-to-email | `tel:` and `mailto:` links on customer detail. | All | Complete | High | Low | |

### 4.20 Demo / Onboarding
| # | Feature | Description | Role | Status | Value | Complexity | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 152 | One-click demo seeder | Inserts 5 customers, 5 properties, 3 estimates, 3 jobs, 4 invoices, 6 expenses, 4 chemicals, 4 equipment, 4 leads, 2 campaigns. | Visitor | Complete | Sales | Medium | |
| 153 | Demo banner | Amber "Demo mode" banner with "Create real account" CTA. | Visitor | Complete | Conversion | Low | |
| 154 | Default services seeded on signup | Per `handle_new_user()` trigger (House Wash, Driveway, Roof, …). | Owner | Complete | Activation | Low | |
| 155 | Guided onboarding wizard | **Missing** | — | Missing | Medium | Medium | |

---

## 5. Planned / Implied Feature Inventory

The following are either explicitly noted in the README/code as TODO, exist as schema fields without UI, or are obvious "v2" needs given the product category.

| Feature | Description | Why it matters | Role | Complexity | Dependencies | Tier |
| --- | --- | --- | --- | --- | --- | --- |
| Crew/dispatch board | Drag-and-drop assign jobs to crews/users; per-crew calendar. | Required for any business with > 1 truck. | Manager / Crew | High | `job_assignments` exists. | MVP for "Pro+". |
| Drag-and-drop calendar | Reschedule by dragging the job card. | Massive UX win. | Owner | Medium | Calendar refactor. | V2. |
| Day view + month view | Calendar only has week. | UX completeness. | Owner | Low | — | V2. |
| Google Calendar 2-way sync | Push jobs, pull blocks. | Owners use Google Cal. | Owner | High | Google OAuth (already in place). | V2. |
| Native iOS/Android crew app | Photos, time clock, offline notes. | Field reality. | Crew | Very high | Storage + auth wrappers. | Premium. |
| Offline support | PWA shell + IndexedDB queue. | Crew uses it without signal. | Crew | High | — | V2. |
| Real PDF export | Endpoints exist named `/pdf` but emit HTML. | Customers/accountants expect PDFs. | Owner | Medium | Headless Chromium or pdfkit. | V2 (essential). |
| SMS notifications & 2-way SMS | Schema has `channel` field; not implemented. | Significantly improves customer comms. | Owner | High | Twilio / Telnyx. | Pro/Premium. |
| Public lead capture form | Embeddable widget for the org's website. | Closes the lead funnel. | Owner | Medium | New public route. | Pro. |
| Recurring invoices / recurring jobs | Monthly contracts. | Commercial accounts depend on it. | Owner | Medium | New scheduler table. | Pro. |
| Subscriptions for the SaaS itself (paywall) | The app currently has **no billing**. Every signup is free. | Required to sell. | Owner | Medium | Stripe Billing / Customer Portal. | MVP for selling. |
| Super-admin / platform console | View all orgs, support, impersonation, suspend. | Required for support staff. | Suds staff | Medium | New `is_superadmin` flag + RLS bypass. | Internal MVP. |
| Audit log | `who-did-what`. | Enterprise / compliance. | Owner | Medium | New `audit_log` table. | Premium. |
| Two-factor auth | Supabase supports it but UI not wired. | Security baseline for owner accounts. | All | Low | — | Pro. |
| Photo annotations (arrows, circles) | README mentions schema-ready; UI not implemented. | Marketing & damage docs. | Owner | Medium | Canvas-based editor. | Pro. |
| Auto-build line items from measurement polygons | Currently you measure, then re-type into the estimate. | Closes the obvious loop. | Owner | Medium | `measurements` → `estimate_line_items` mapping. | MVP-quality fix. |
| Bulk receipt upload + OCR | `lib/receipt-upload.ts` exists; no UI flow. | Saves hours at tax time. | Owner | High | OCR API. | Premium. |
| QuickBooks export / sync | Accountant compatibility. | Existing operators won't switch without it. | Owner | High | QBO API. | Pro. |
| White-label customer portal | Customers log in to view all their docs/properties. | Commercial accounts request it. | Customer | High | New auth surface. | Premium. |
| Multi-location / branches | A franchise or multi-region operator. | Enterprise. | Owner | High | Schema rework. | Enterprise. |
| Per-user permissions matrix | Row-level role enforcement beyond `org_member`. | Enterprise. | Manager | Medium | New permissions table. | Enterprise. |
| API access for integrations | Public REST API + API keys. | Enterprise. | Developer | High | Edge Functions / new routes. | Enterprise. |
| Custom branding (logo, colors) | `logo_url` column unused. | Pro/Premium. | Owner | Low | Storage upload. | Pro. |
| Equipment maintenance log | Currently only single date fields. | Real fleet management. | Owner | Medium | New table. | Pro. |
| Route optimization | Optimal driving order for the day. | Multi-truck owners. | Manager | Very high | Maps Distance Matrix API. | Premium. |
| Time clock / payroll prep | Crew clock-in/out tied to job. | Multi-employee orgs. | Crew | High | New table. | Pro. |
| AI quote auto-fill from address | Type address → AI suggests services + sqft. | Differentiator. | Owner | High | LLM + Maps. | Premium. |
| AI photo damage detection | Pre-job photos → flagged surfaces. | Differentiator. | Owner | Very high | CV model. | Premium. |
| Estimate templates | "Standard residential" preset. | Speeds quoting. | Owner | Low | Reuse existing schema. | MVP-quality fix. |
| Tagging filter on customers list | `tags[]` exists, no filter UI. | UX. | Owner | Low | — | V2. |

---

## 6. User Roles and Permissions

The schema includes `organization_members.role` (default `"owner"`) and `job_assignments.role`, but the application code does **not currently differentiate permissions between roles** — any signed-in user with org membership has full access. The matrix below is the **target** state needed for the product to ship into a multi-user organization.

| Permission | Super Admin | Owner / Account Owner | Manager | Dispatcher / Office | Field Crew | Customer (public token) |
| --- | --- | --- | --- | --- | --- | --- |
| View dashboard | All orgs | Own org | Own org | Own org | Their assignments | — |
| View customers | All | All | All | All | Only on assigned jobs | Self |
| Create / edit customers | — | ✓ | ✓ | ✓ | — | — |
| Delete customers | — | ✓ | — | — | — | — |
| View estimates | All | All | All | All | On assigned jobs | Their own (token) |
| Create estimates | — | ✓ | ✓ | ✓ | — | — |
| Approve / decline estimate | — | — | — | — | — | ✓ (token) |
| View jobs | All | All | All | All | Assigned only | — |
| Create / schedule jobs | — | ✓ | ✓ | ✓ | — | — |
| Start / complete job | — | ✓ | ✓ | ✓ | ✓ on own | — |
| Upload before/after photos | — | ✓ | ✓ | ✓ | ✓ on own | — |
| View invoices | All | All | All | All | — | Their own (token) |
| Create invoices | — | ✓ | ✓ | ✓ | — | — |
| Take payment | — | ✓ | ✓ | ✓ | ✓ on own job | Pay via Stripe |
| Refund payment | — | ✓ | ✓ | — | — | — |
| View P&L / accounting | — | ✓ | ✓ | — | — | — |
| Edit services & pricing | — | ✓ | — | — | — | — |
| Edit settings (org info, integrations) | All orgs | ✓ | — | — | — | — |
| Manage team / roles | — | ✓ | — | — | — | — |
| Disconnect Google Drive | — | ✓ | — | — | — | — |
| Suspend organization | ✓ | — | — | — | — | — |
| Impersonate user | ✓ | — | — | — | — | — |
| View audit log | ✓ | ✓ | ✓ | — | — | — |

**Status today:** All roles except "owner" and "anonymous public token" need to be **implemented** in the code. The schema and partial seeds are in place.

---

## 7. Major Software Modules

| Module | Description | Features included | Roles | Importance | Build complexity | Recommended tier |
| --- | --- | --- | --- | --- | --- | --- |
| **Auth & Multi-tenancy** | Supabase auth, RLS-scoped orgs, demo mode, refresh middleware. | Signup, login, demo, sign-out, RLS, refresh. | All | Critical | Medium | All tiers. |
| **Dashboard** | KPI + action item home. | Revenue MTD, A/R, jobs, follow-ups, low stock, equipment due. | Owner / Manager | Critical | Low | All tiers. |
| **CRM** | Customers + properties. | Customer CRUD, multi-property, search, tags, history. | Owner / Office | Critical | Medium | All tiers. |
| **Estimates** | Quote creation through customer approval. | Line items, photos, deposit, expiry, public approval token. | Owner / Office | Critical | High | All tiers. |
| **Jobs / Field Ops** | Scheduling, status, photos, gallery links. | Job CRUD, statuses, before/after photos, public gallery, reminders. | Owner / Crew | Critical | High | All tiers. |
| **Calendar** | Week view of jobs. | Week navigation, day cards, click-through. | Owner / Dispatcher | High | Medium | All tiers. |
| **Invoices** | Billing through receipt. | Line items, Stripe link, manual recording, send, PDF/HTML, status. | Owner / Office | Critical | High | All tiers. |
| **Payments** | Ledger of all received payments. | Filterable list, Stripe-linked, partial. | Owner | Critical | Low | All tiers. |
| **Services & Pricing** | Catalog + pricing rules. | Per-unit pricing, modifiers, deposit/min rules. | Owner | Critical | Medium | All tiers. |
| **Satellite Measurement** | Polygon sqft on hybrid imagery. | Geocode, polygon, area, material/service tagging, save to property. | Owner | **Differentiator** | High | Pro+. |
| **Chemicals & Mix** | Inventory + mix calculator. | Stock + reorder, transactions, SDS, mix, recipes. | Owner / Crew | **Differentiator** (industry niche) | Medium | Pro+. |
| **Equipment** | Asset list + service alerts. | CRUD, status, next service. | Owner | Medium | Low | Pro+. |
| **Expenses & Accounting** | Costs + P&L. | Filtered expense list, charts, P&L, vendor breakdown. | Owner / Manager | Critical | High | All tiers. |
| **Marketing (Leads + Campaigns)** | Lead pipeline + ad spend tracker. | Lead pipeline, conversion, campaign budgets. | Owner | High | Medium | Pro+. |
| **Reminders + Reviews** | Email queue + auto review router. | Cron-driven sends, smart 1-3/4-5 review router. | System / Owner | High | Medium | Pro+. |
| **Documents & Drive** | HTML doc generation + Google Drive upload. | Invoice/estimate HTML, OAuth Drive, folder per type. | Owner | Medium | High | Pro+. |
| **Settings** | Org config + integration switchboard. | Business info, prefixes, integration status. | Owner | Critical | Low | All tiers. |
| **Workflow Stepper / Next-Step Banner** | Cross-cutting guided flow. | Estimate → invoice → paid → receipt visualization and one-click next action. | Owner | **Differentiator** | High | All tiers. |
| **Mobile shell** | Responsive nav + camera capture. | Bottom tabs, sidebar drawer, mobile-first inputs. | All | Critical | Medium | All tiers. |
| **Customer-facing public pages** | Quote approval, gallery, review. | `/quote/<token>`, `/gallery/<token>`, `/review/<token>`. | Customer | Critical | Medium | All tiers. |
| **Demo / Onboarding** | Anonymous trial + sample data seeder. | One-click demo, default services, demo banner. | Visitor | Sales | Medium | All tiers. |
| **(Planned) Crew & Dispatch** | Per-user assignments + dispatch board. | Assign jobs, per-crew calendar. | Manager | High | High | Pro+. |
| **(Planned) Subscriptions / Billing** | Charging the SaaS customer. | Stripe Billing, plan selection, paywall. | Owner / Suds | Critical to monetize | Medium | All tiers. |
| **(Planned) Super-admin Console** | Platform staff tools. | Org list, impersonation, suspend, support. | Suds staff | Critical for support | Medium | Internal. |
| **(Planned) AI features** | Auto-quote, photo damage, smart reminders. | Per Section 5. | Owner | Differentiator | Very high | Premium. |

---

## 8. Workflow Documentation

The product is built around a **single linear workflow** (also visualized in the UI as the Workflow Stepper). It is the strongest UX in the codebase.

### 8.1 New customer creation
- **Trigger:** Owner clicks "+ New customer" or `+ Customer` from a sub-form.
- **Steps:** Choose residential/commercial → enter name/email/phone/lead source → optional first property (address). Submit.
- **Roles:** Owner / Office.
- **Data created:** `customers` row, optional `properties` row.
- **Notifications:** None.
- **Edge cases:** Quick-create form requires at least one of first_name / last_name / company_name (validated in `quick-actions.ts`).

### 8.2 New estimate creation
- **Trigger:** Owner clicks "+ Estimate" (global or from a customer).
- **Steps:** Pick customer → optional property → add line items (description, qty, unit price, photos) → set tax / discount / notes / terms / internal duration → submit.
- **Server logic:** Computes subtotal, applies global min-job, applies tax + discount, calculates auto-deposit, generates `EST-####`, generates `approval_token` UUID, inserts estimate + line items, returns to detail page.
- **Data created:** `estimates`, `estimate_line_items`.
- **Notifications:** None until "Send".
- **Edge cases:** No line items → falls back to "Minimum service charge" if global min triggered.

### 8.3 Estimate approval / decline (customer)
- **Trigger:** Customer opens emailed `/quote/<token>` link.
- **Steps:** Reviews line items, totals, deposit, terms → enters signature → clicks "Approve" or expands the "Decline" disclosure.
- **Server logic:** `approveQuote` → calls Postgres RPC `accept_estimate_by_token(p_token, p_signature)` (defined in DB; not in TS code). Owner-side then auto-creates an open job via `ensureJobForEstimate`.
- **Data updated:** estimate status = `accepted` or `declined`, `accepted_at`, `declined_reason`. Job created.
- **Notifications:** None automatic to owner. (Gap.)
- **Edge cases:** Expired (`expires_at` past) shows banner; already-responded shows status.

### 8.4 Scheduling a job
- **Trigger:** Owner picks a start time on the job page or via Workflow next-step banner.
- **Steps:** Enter `scheduled_start` and optional `scheduled_end`.
- **Server logic:** `scheduleJob` updates job, deletes any existing scheduled appointment reminder for the job, inserts a fresh one at `start - appointment_reminder_hours`.
- **Data updated:** `jobs.scheduled_start/end`, `customer_reminders` row.
- **Notifications:** Will fire from cron at scheduled time.
- **Edge cases:** If start is sooner than the lead time, no reminder is queued.

### 8.5 Crew completing a job (intended workflow)
- **Trigger:** Crew at the property.
- **Steps today:** Owner taps "Start" → on-site → uploads before photos via `PhotoUploader` → does work → uploads after photos → taps "Complete".
- **Server logic on Complete:** Sets `actual_end`, then auto-drafts an invoice from the linked estimate's line items (or from job total). Returns to jobs list. Photos are saved with `kind` flag (the page swaps default to `after` once complete).
- **Data created/updated:** `jobs.actual_start/end/status`, `invoices` (draft), `invoice_line_items`, `photo_attachments` rows.
- **Roles:** Today owner; intended crew.
- **Edge cases:** Without a linked estimate, the auto-draft uses the job's `total_amount`; if 0, no line items inserted. **Gap:** No way for a separate crew user to do this without owner permissions.

### 8.6 Generating a customer-facing before/after gallery
- **Trigger:** Owner taps "+ Generate before/after gallery link" on a job.
- **Steps:** One click.
- **Server logic:** `createGalleryLink` inserts a `public_galleries` row with random token.
- **Data created:** `public_galleries` row.
- **Notifications:** None automatic — the owner shares the URL manually.
- **Edge cases:** Multiple galleries per job possible (no de-dup).

### 8.7 Generating an invoice
- **Three paths:**
  1. Auto on job completion (Section 8.5).
  2. Manual conversion from estimate (`convertEstimateToInvoice`) — also creates a completed job to link the chain.
  3. Standalone `/invoices/new`.
- **Server logic:** `INV-####` numbering, due date = today + 14, copies line items + photos.

### 8.8 Sending an invoice + auto Stripe link
- **Trigger:** Owner clicks "Email invoice" on detail or via next-step banner.
- **Steps:**
  1. If Stripe configured and link not yet created, calls `createStripePaymentLink`: creates Stripe Products + Prices for each line item, then a Payment Link with metadata `{ invoice_id, organization_id, invoice_number }`.
  2. Stores `stripe_payment_link` on invoice.
  3. Renders `invoiceHtml`, prepends a "Pay invoice online" CTA.
  4. Sends via Resend; reply-to = org email.
  5. Updates invoice status from `draft` to `sent`.
- **Edge cases:** Customer has no email → throws error. Stripe error → email is still sent without the CTA.

### 8.9 Taking a payment
- **Two paths:**
  - **Online (Stripe):** Customer pays the link → Stripe webhook hits `/api/stripe/webhook` → verifies signature → looks up invoice via metadata → inserts payment + recomputes balance → marks invoice `paid` if zeroed.
  - **In-person (cash/check/card/ACH):** Owner submits the payment form on the invoice page → `recordPayment` inserts into `payments`, recomputes amount_paid + balance, sets status (`partial` or `paid`), then:
    - If "send receipt" checked AND customer has email: sends Resend "PAID" stamp HTML and logs to `receipt_log`.
    - If invoice fully paid: queues a review request (writes `review_feedback` row + immediately sends the rating email via Resend) **AND** queues a recurring service reminder N months out.
- **Edge cases:** Webhook uses anon key; for production a service-role key is recommended (commented in code).

### 8.10 Customer reviews
- **Trigger:** Customer opens emailed `/review/<token>` link.
- **Steps:** Pick 1–5 stars, optional comment, submit.
- **Server logic:** `submitReview` records `rating`, `comment`, `responded_at`. If rating ≥ 4 AND org has Google review URL, the thank-you screen shows a "Leave a Google review" button.
- **Edge cases:** Already responded → thank-you screen shown, no double review.

### 8.11 Reminders processing
- **Trigger:** External cron POSTs `/api/cron/reminders` with Bearer `CRON_SECRET`.
- **Steps:** Selects up to 50 `customer_reminders` where `status='scheduled'` AND `scheduled_for <= now`. For each, builds a per-kind subject/body, sends via Resend, updates status to `sent` or `failed` with timestamp.
- **Edge cases:** Customer with no email → status `skipped` (counted) but row stays `scheduled` (potential bug — would re-attempt on next run).

### 8.12 Reporting / business review
- **Trigger:** Owner navigates to `/reports`.
- **Steps:** Pick period chip → page builds P&L from `payments` (revenue) and `expenses` (costs), plus 6-month bar chart, top vendors, payment method mix.
- **Edge cases:** No data → zeros, but UI still renders.

---

## 9. Data Model / Database Requirements

24 tables exist in the analyzed `Database` type. All include `organization_id` and use `is_org_member()` RLS.

### 9.1 Existing tables
| Table | Purpose | Key fields | Relationships | Status |
| --- | --- | --- | --- | --- |
| `organizations` | The tenant. | `name`, `address_*`, `phone`, `email`, `website`, `tax_rate`, `currency`, `invoice_prefix`/`estimate_prefix`, `next_invoice_number`/`next_estimate_number`, `stripe_account_id`, `logo_url`. (Also referenced in code: `global_min_job_price`, `deposit_threshold`, `deposit_percentage`, `appointment_reminder_hours`, `recurring_reminder_months`, `google_review_url`, `review_request_enabled`, `is_demo` — present in DB, missing from typed schema file.) | parent of all org-scoped tables | Complete; type file out of date with several columns. |
| `profiles` | Per-user profile linked to `auth.users`. | `full_name`, `phone`, `default_organization_id`, `avatar_url`. | belongs to user. | Complete. |
| `organization_members` | Many-to-many users ↔ orgs. | `role` (default `owner`). | `organizations`, `auth.users`. | Complete; role not enforced. |
| `customers` | Account record. | `customer_type` (residential/commercial), `first/last/company_name`, `email`, `phone`, `mobile_phone`, `lead_source`, `tags[]`, `notes`. | parent of properties, estimates, jobs, invoices. | Complete. |
| `properties` | Service location. | `address_*`, `nickname`, `square_footage`, `stories`, `gate_code`, `latitude`, `longitude`, `notes`. | belongs to customer. | Complete. |
| `services` | Catalog. | `name`, `category`, `pricing_unit`, `default_price`, `active`. (Code references additionally: `is_addon`, `material_modifiers` JSON, `min_price`, `default_duration_minutes`, `height_modifier_per_story`, `price_per_sqft`, `price_per_linear_ft` — present in DB, missing from typed schema file.) | — | Complete; type file out of date. |
| `estimates` | Quote header. | `estimate_number`, `customer_id`, `property_id`, status, totals, dates, `approval_token`. (Plus `duration_minutes`, `buffer_minutes`, `deposit_amount`, `declined_reason` referenced in code.) | belongs to customer; can convert to invoice and create job. | Complete. |
| `estimate_line_items` | Quote rows. | `description`, `quantity`, `unit_price`, `total`, `sort_order`, `service_id`. (Plus `photo_urls[]` referenced in code.) | belongs to estimate. | Complete. |
| `jobs` | Field appointment / work order. | `job_number` (unused in code paths seen), `title`, `status`, `scheduled_start/end`, `actual_start/end`, `total_amount`, `before_photos[]`/`after_photos[]`, `estimate_id`, `property_id`. (Plus `duration_minutes`, `buffer_minutes` referenced in code.) | belongs to customer/property/estimate. | Complete. |
| `job_assignments` | Crew membership on a job. | `job_id`, `user_id`, `role`. | composite. | Schema only — no UI. |
| `invoices` | Bill header. | `invoice_number`, totals, dates, status, `stripe_payment_link`, `amount_paid`, `balance_due`, `estimate_id`, `job_id`. | belongs to customer; optionally to job/estimate. | Complete. |
| `invoice_line_items` | Bill rows. | Same shape as estimate items. (Plus `photo_urls[]` referenced in code.) | belongs to invoice. | Complete. |
| `payments` | Inflows. | `amount`, `payment_method`, `payment_date`, `reference_number`, `stripe_payment_intent_id`. | belongs to invoice + customer. | Complete. |
| `expenses` | Outflows. | `amount`, `vendor`, `category_id`, `expense_date`, `payment_method`, `tax_deductible`, `receipt_url`, optional `job_id`. | belongs to org. | Complete. |
| `expense_categories` | Per-org. | `name`, `description`. Seeded on signup. | — | Complete. |
| `chemicals` | Inventory items. | `name`, `brand`, `category`, `unit`, `current_stock`, `reorder_level`, `cost_per_unit`, `supplier`, `sds_url`, `hazard_class`, `sku`. | parent of transactions. | Complete. |
| `chemical_transactions` | Stock movement log. | `chemical_id`, `transaction_type` (purchase/usage/waste/adjustment), `quantity`, `cost`, optional `job_id`. | — | Complete. |
| `equipment` | Asset list. | `name`, `type`, `serial_number`, `purchase_date/price`, `current_value`, `status`, `hours_used`, `last_service_date`, `next_service_date`. | — | Complete. |
| `leads` | Pipeline. | `first/last/company`, contact, `address`, `source_id`, `status`, `estimated_value`, `contacted_at`, `converted_to_customer_id`. | — | Complete. |
| `lead_sources` | Catalog. | `name`, `cost_per_month`, `active`. Seeded on signup. | — | Complete. |
| `campaigns` | Ad spend. | `name`, `channel`, `budget`, `spent`, `start_date`, `end_date`, `leads_generated`, `status`. (Plus `impressions`, `clicks`, `conversions` referenced in code/seed.) | — | Complete. |
| `measurements` | Saved polygons. | `polygon` JSON, `area_sqft`, `perimeter_ft`, `material`, `label`, `service_id`, `property_id`, `center_lat/lng`. | — | Complete. |
| `google_drive_connections` | Per-org OAuth tokens. | `refresh_token`, `access_token`, expiry, folder IDs (drive/invoices/estimates/photos/receipts), `connected_email`. | one per org. | Complete. |
| `receipt_log` | Audit of every receipt sent. | `provider` (resend), `provider_id`, `email_to`, `status`. | belongs to invoice + payment. | Complete. |

### 9.2 Tables referenced in code but missing from typed schema
> The TypeScript file `src/lib/types/database.ts` is **out of date** vs. the live database. The following tables are queried in app code:

| Table | Purpose | Source |
| --- | --- | --- |
| `customer_reminders` | Reminder queue (appointment, recurring_service, review_request). | `jobs/actions.ts`, `invoices/actions.ts`, `api/cron/reminders/route.ts` |
| `review_feedback` | 1–5 star feedback collected from `/review/<token>`. | `invoices/actions.ts`, `review/[token]/page.tsx` |
| `public_galleries` | Public token-scoped before/after pages. | `jobs/[id]/gallery-actions.ts`, `gallery/[token]/page.tsx` |
| `photo_attachments` | Generic photo store keyed by job/estimate/invoice/property. | `photo-uploader.tsx`, `gallery/[token]/page.tsx`, `jobs/[id]/page.tsx` |
| `chemical_recipes` | Saved mix calculator recipes. | `mix/page.tsx` |

### 9.3 Tables / fields recommended but **missing** entirely
| Entity | Why needed |
| --- | --- |
| `users_subscriptions` / `org_subscriptions` (Stripe Billing for the SaaS itself) | The product currently has no paywall. |
| `audit_log` | Compliance, support investigation. |
| `crews` (and `crew_members`) | Multi-truck dispatch beyond per-job assignments. |
| `time_entries` | Crew clock-in/out for payroll prep. |
| `notifications` (in-app) | UI bell with unread count. |
| `recurring_jobs` / `service_contracts` | Monthly commercial accounts. |
| `email_templates` / `sms_templates` | Owner customizing customer-facing copy. |
| `webhooks_outgoing` | Enterprise integrations. |
| `documents` (general file store) | Beyond receipt URL string. |
| `super_admins` | Platform staff role. |

---

## 10. Integrations

| Service | Purpose | Status today | API keys / accounts | Approx monthly cost | Complexity | MVP? |
| --- | --- | --- | --- | --- | --- | --- |
| **Supabase** | Auth, Postgres, Storage, RLS. | **Required, fully wired.** | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. (Service role key recommended for webhook prod path.) | $0 free → $25/mo Pro → scales. | High | Yes. |
| **Stripe** | Online invoice payments + webhook auto-record. | **Implemented; degrades gracefully if missing.** | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`. | $0 platform + 2.9% + $0.30/transaction (passed to operator). | High | Yes (recommended). |
| **Resend** | Transactional email — receipts, invoices, estimates, reminders, review requests. | **Implemented; degrades gracefully.** | `RESEND_API_KEY`, `RESEND_FROM`. | $0 free (3K/mo) → $20/mo Pro (50K/mo). | Medium | Yes. |
| **Google Drive** | Save invoices/estimates/photos/receipts to org's Drive. | **Implemented OAuth + multipart upload.** | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, OAuth setup. | $0 (uses customer's own Google account / Workspace). | High | Optional. |
| **Google Maps Platform** | Satellite tile, drawing, geometry, places, geocoding. | **Implemented.** | `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`. Enable: Maps JS, Drawing, Geometry, Places, Geocoding. | Pay-as-you-go; $200 free credit/mo, then ~$0.005–0.007 per map load + ~$0.005 per geocode. **Could be the biggest variable cost as you scale.** | Medium | Yes (differentiator). |
| **Vercel** | Hosting (per README "Deploy to Vercel"). | **Targeted.** | — | Free hobby → $20/user/mo Pro. | Low | Yes. |
| **External cron** (Vercel Cron / GitHub Actions / Supabase Scheduled) | Triggers `/api/cron/reminders`. | **Endpoint exists; cron must be configured externally.** | `CRON_SECRET`. | Free (Vercel cron). | Low | Yes. |
| **Twilio / Telnyx (SMS)** | Reminders + notifications via SMS. | **Not implemented.** Schema-ready. | API key. | Pay-per-SMS ~$0.0079/SMS. | High | Pro tier. |
| **QuickBooks Online** | Accounting export / sync. | **Not implemented.** | OAuth. | — | High | Pro tier. |
| **Stripe Billing** (for the SaaS subscription itself) | Charge customers for Suds. | **Not implemented.** | Same Stripe account. | 0.5% Stripe Billing fee. | Medium | Required to monetize. |
| **OpenAI / Anthropic / etc.** | AI quote auto-fill, photo analysis, summarization. | **Not implemented.** | API key. | Usage-based. | High | Premium tier. |
| **Plaid** (bank feed for expenses) | Auto-import expenses. | **Not implemented.** | API key. | $0.30–$1+/connection/mo. | High | Premium tier. |
| **Lead form embeds (HubSpot/Mailchimp/etc.)** | Inbound from website. | **Not implemented.** | — | — | Low | Pro tier. |
| **Sentry / PostHog / LogRocket** | Error monitoring + product analytics. | **Not implemented.** | API key. | $0–$30/mo small. | Low | Internal MVP. |

---

## 11. Technical Architecture

| Layer | Choice | Notes |
| --- | --- | --- |
| **Frontend framework** | Next.js 14 (App Router), React 18.3, TypeScript 5.7. | React Server Components + Server Actions throughout. Mostly server-rendered; minimal client JS. |
| **Styling** | Tailwind 3.4 + custom design tokens (brand-50…brand-700). `clsx` + `tailwind-merge`. | `tailwind.config.ts` defines tokens. |
| **Backend framework** | Next.js Route Handlers + Server Actions. No separate Node service. | All "API" lives in `/api/*` route handlers; "controllers" are Server Actions in `actions.ts` files. |
| **Database** | Supabase Postgres. | 24 typed tables; ~5 additional tables exist in DB but are not in the type file (out of sync). |
| **Authentication** | Supabase Auth (email/password + anonymous). | Cookies via `@supabase/ssr`; year-long max-age. Middleware refreshes silently. |
| **Authorization** | Row-Level Security on every table via `is_org_member(org_id)`. Public flows (quote/gallery/review) use random token policies. | All queries pass through `getSessionAndOrg()` which enforces tenant context. |
| **File storage** | Supabase Storage `photos` bucket; signed URLs (1 yr). Documents may also be uploaded to the customer's Google Drive. | |
| **Payments** | Stripe Payment Links + checkout webhook. | Webhook validates signature with `STRIPE_WEBHOOK_SECRET`. |
| **Email** | Resend HTTP API (no SDK; `fetch` only). | Templates inlined as HTML strings. |
| **Maps** | Google Maps JS SDK loaded dynamically (`drawing,geometry,places` libs). | Geocoding via `Geocoder` class. |
| **State management** | Server-component first; minimal client state with `useState`. No Redux/Zustand. | |
| **Routing** | App Router segments: `(app)` (authenticated), `(auth)` (login/signup/demo), public `quote/[token]`, `gallery/[token]`, `review/[token]`. | Middleware matcher excludes static. |
| **Validation** | `zod` is a dependency; not aggressively used in route handlers. Most server actions parse `FormData` with manual `String(...)` casts. | Validation gap. |
| **API structure** | `/api/cron/reminders`, `/api/google/connect`, `/api/google/callback`, `/api/stripe/webhook`, `/api/documents/{invoices,estimates}/[id]/pdf`. Other writes are Server Actions. | |
| **Mobile/responsive** | Mobile bottom tab bar, top hamburger drawer, desktop sidebar. Camera capture on mobile photo input. | No PWA manifest. |
| **Offline support** | None. | Significant gap for field crew. |
| **Security design** | RLS, signed cookies, signed Stripe webhooks, signed Supabase Storage URLs, OAuth state parameter. The Stripe webhook uses anon key + metadata validation (code comment: "for production, swap to SUPABASE_SERVICE_ROLE_KEY"). | |
| **Audit logging** | `receipt_log` exists. No general audit trail. | |
| **Third-party libs** (production) | `@supabase/ssr ^0.5`, `@supabase/supabase-js ^2.46`, `next ^14.2.18`, `react ^18.3`, `stripe ^17.4`, `clsx`, `tailwind-merge`, `date-fns`, `zod`. | Lean dependency footprint. |
| **Environment variables** | 11 env vars listed in `.env.local.example` (Section 10). | App degrades gracefully when missing. |
| **Deployment** | Vercel (per README). External cron required for reminders. Stripe webhook URL must be configured. | One-click `vercel`. |
| **CI/CD** | None visible. | Gap. |
| **Tests** | None visible. | Gap. |

---

## 12. Non-Functional Requirements

| Requirement | Current state | Notes |
| --- | --- | --- |
| **Performance** | Server-rendered; light client JS. Dashboard fires ~15 parallel Supabase queries. | Should support hundreds of customers per org without further optimization. Beyond ~10K rows per table per org, indexes/pagination need attention. |
| **Uptime / reliability** | Inherits from Supabase + Vercel SLAs. | No graceful degradation if DB is down beyond default error pages. |
| **Security** | RLS enforced; signed Stripe webhooks; OAuth state; signed photo URLs. Webhook anon-key path documented as needing service-role swap. No 2FA UI. No CSRF tokens (App Router same-site cookies). | Should pass a basic SaaS security checklist. Recommend explicit threat model + 2FA before enterprise. |
| **User privacy** | All org data isolated by RLS. Photos signed for 1 year. No cookie consent banner, no GDPR toolkit (delete-my-data flow). | Add for EU sales. |
| **Data backup** | Inherits from Supabase Pro daily backups. | Customers have no self-serve export. |
| **Mobile responsiveness** | Strong. Bottom tabs, drawer, large tap targets. | No PWA install prompt or offline caching. |
| **Accessibility** | Basic semantic HTML; some `aria-label` on icon buttons. No formal audit. | Likely fails WCAG 2.1 AA without polish (color contrast, focus rings, form labels). |
| **Scalability** | Multi-tenant by design. Single Postgres scales to thousands of orgs without changes. | Photo storage and Maps API budget scale linearly with usage and need monitoring. |
| **Multi-tenant support** | First-class. | Roles within tenant: not enforced yet. |
| **Logging** | `console.error` only. | No structured logs / Sentry / log drain. |
| **Error handling** | Server actions throw raw `Error.message`; many places use `as any` to bypass typing. | Inconsistent UX on failure. |
| **Audit trails** | `receipt_log` only. | Add `audit_log` for who-did-what before enterprise sales. |
| **Compliance concerns** | No PCI scope (Stripe-hosted). No HIPAA/SOC2/GDPR controls. Tax handling is single-rate, single-jurisdiction (org-level). No 1099/W-2 reporting. | Likely sufficient for SMB pressure-washing market. |

---

## 13. MVP Definition

### 13.1 Must-have for launch ("can sell at $39–$79/mo")
All already implemented unless flagged.
- Auth + RLS multi-tenant ✓
- Customers + properties ✓
- Estimates with line items + photos ✓
- Public quote approval ✓
- Jobs scheduling + status + photos ✓
- Auto-invoice on job complete ✓
- Send invoice email ✓
- Stripe payment link + webhook auto-record ✓
- Manual payment recording ✓
- Auto-emailed receipt ✓
- Calendar (week view) ✓
- Settings + integrations ✓
- Mobile responsive shell ✓
- Demo mode ✓
- **(Add)** Stripe Billing for the SaaS itself — required to charge customers.
- **(Add)** Real PDF export — currently HTML-only and labeled `/pdf`.
- **(Add)** Auto-build line items from saved measurement polygons — workflow gap.

### 13.2 Should-have soon after launch (90 days)
- Crew/dispatch role + permission enforcement.
- Drag-and-drop calendar.
- SMS notifications via Twilio.
- Public lead capture form embed.
- Recurring jobs / recurring invoices.
- Equipment maintenance log.
- Estimate templates.
- 2FA on owner accounts.
- Bulk customer / data export.
- In-app notifications bell.

### 13.3 Nice-to-have
- Photo annotations.
- Tag filtering on customers list.
- Custom branding (logo upload).
- Day / month calendar views.
- Mileage log on expenses.

### 13.4 Premium / upsell features
- AI quote auto-fill from address.
- AI photo damage detection.
- Route optimization.
- White-label customer portal.
- Bulk receipt OCR.
- QuickBooks 2-way sync.
- Plaid bank feed.

### 13.5 Enterprise-only features
- Multi-location / multi-branch.
- Role/permission matrix editor.
- API + webhooks.
- Audit log + data residency.
- SSO / SAML.
- Dedicated account manager + SLA.

---

## 14. Pricing-Relevant Feature Breakdown

> Suggested tiering — can be re-bucketed by a pricing analyst.

### 14.1 Basic ("Solo Operator") — target $29–$49/mo
**Buyer:** sole owner-operator, 0 employees.
**Includes:** 1 user; up to 100 active customers; everything in core money path:
- Dashboard + KPIs.
- Customers + properties + tags + search.
- Estimates with line items and digital approval (`/quote/<token>`).
- Calendar week view.
- Jobs + statuses + photos + before/after gallery link.
- Invoices + Stripe payment link + manual payment recording + auto receipt.
- Expenses + categories + basic P&L.
- Services & pricing rules.
- Mobile shell + camera capture.
- Email-only reminders (appointment + recurring service).
**Why valuable:** replaces Square + Google Sheets + paper for a one-person business at a price that beats any combination of competitors.

### 14.2 Pro ("Growing Crew") — target $79–$129/mo
**Buyer:** 2–4 user team, multi-truck.
**Adds on top of Basic:**
- Up to 5–10 users with role-based permissions (Owner / Manager / Dispatcher / Crew).
- Crew assignments + dispatch view.
- Drag-and-drop calendar + day/month views.
- Satellite measurement tool.
- Chemical inventory + mix calculator + low-stock alerts.
- Equipment + service due alerts.
- Lead pipeline + campaign tracker + auto review router.
- SMS notifications (Twilio metered).
- Recurring jobs / recurring invoices.
- Public lead capture form embed.
- 2FA.
- Custom branding (logo, accent color).
- QuickBooks export.

### 14.3 Premium ("Established Multi-Truck") — target $199–$349/mo
**Buyer:** 3–8 trucks, $500K–$2M revenue.
**Adds on top of Pro:**
- Unlimited users.
- Route optimization.
- Multi-location / multi-branch.
- White-label customer portal (customer log-in for docs, history, recurring service).
- AI features (auto-quote, smart reminders, photo damage detection).
- Bulk receipt OCR.
- Plaid bank feed for expenses.
- Native iOS/Android crew app.
- Time clock + payroll prep export.
- Audit log + advanced reporting (per-crew P&L, per-route ROI, customer LTV).
- Priority email support.

### 14.4 Enterprise ("Franchise / Regional Operator") — target $599+/mo or annual contract
**Buyer:** franchises, regional consolidators, multi-brand operators.
**Adds on top of Premium:**
- SSO / SAML.
- API access + outgoing webhooks.
- Custom integrations.
- Dedicated CSM + SLA.
- Advanced permissions matrix.
- Multi-brand support (one company runs multiple brands under one login).
- Data residency / sandbox env.
- Custom contract terms, BAA / DPA available.

---

## 15. Competitive Comparison

| Category | Examples | Where Suds wins | Where Suds loses |
| --- | --- | --- | --- |
| **Generic CRM** | HubSpot Free, Pipedrive, Zoho. | Industry-specific data model (jobs, properties, sqft, chemicals). Workflow stepper. | No marketing automation, no sales pipelines for B2B reps, no email sequences. |
| **Field service management (general)** | Jobber, Housecall Pro, ServiceTitan. | Cheaper at the bottom; pressure-washing-native (mix calculator, satellite measure, SH inventory, height/material modifiers). Built-in digital quote approval link. | They have native apps, route optimization, payroll, two-way SMS, larger integrations marketplaces, longer track records, larger support teams. |
| **Pressure-washing-specific** | PowerWashr, Wash Talk, custom Excel templates. | Modern stack, full SaaS, integrated payments. | Most niche tools have established communities (PWRA, Facebook groups). |
| **Scheduling apps** | Calendly, Square Appointments. | Knows about properties, reminders, before/after photos. | Calendly is cheaper for scheduling-only use cases. |
| **Invoicing apps** | Square Invoices, Stripe Invoicing, FreshBooks. | Connected to job + customer + estimate; auto-receipt + review request; per-line photos. | FreshBooks/QuickBooks have decades of accountant trust. |
| **Spreadsheets / paper / texts** | — | Wins decisively on every dimension once owner is past 10 customers. | Free. |

**Net positioning:** **A focused, modern, mobile-first all-in-one for pressure washers** — sits between Jobber Lite ($49/mo) and Jobber Connect ($129/mo), with a unique satellite-measurement + mix-calculator + chemical-inventory triad that no general FSM tool offers natively.

---

## 16. Development Effort Estimate

The codebase represents roughly the following **already-completed** work. Estimates assume one experienced full-stack TypeScript developer with prior Next.js + Supabase + Stripe experience.

| Area | Lines | Already-built effort | Remaining-to-MVP effort |
| --- | --- | --- | --- |
| Frontend (pages, components, layouts) | ~3,400 LOC | ~10–14 dev-weeks | 4–6 weeks (paywall UI, billing, dispatch board, real PDF, drag-cal). |
| Backend (Server Actions, API routes) | ~1,800 LOC | ~6–8 weeks | 3–4 weeks (subscriptions, super-admin, role enforcement, refunds, recurring). |
| Database design + RLS + triggers | ~24 tables + RPC + triggers | ~2–3 weeks | 1–2 weeks (subscriptions, audit, recurring, time entries). |
| Auth & security | Supabase + middleware + tokens | ~1 week | 1 week (2FA, role enforcement, super-admin). |
| Integrations (Stripe, Resend, Drive OAuth, Maps) | 4 fully wired | ~3–4 weeks | 2–3 weeks (SMS, QBO, Stripe Billing, Plaid). |
| Admin tools (super-admin, billing console) | None | — | 2–3 weeks. |
| Testing / QA | None visible | — | 4–6 weeks (a real test suite + manual QA pass). |
| Deployment + observability | Vercel target; no CI / Sentry | ~0.5 week | 1–2 weeks. |
| Documentation (user help, API, marketing site) | README only | ~0.5 week | 2–4 weeks. |
| Ongoing maintenance | — | — | 0.5–1 FTE year-round. |

**Totals (already-built):** ≈ **23–32 dev-weeks** (≈ 5.5–8 months of one full-time senior engineer) of actual product code.

**Totals (MVP-ready to sell):** an additional **15–25 dev-weeks** (≈ 3.5–6 months) of one senior + part-time designer/QA.

**Team shape:** A single strong full-stack engineer can run this product. To accelerate, add: 1 designer (0.5 FTE), 1 QA (0.5 FTE), and 1 support person once paying customers exist.

---

## 17. Cost to Build Estimate

US/EU rates, gross figures (rates for India / LatAm should be discounted ~50–70%).

| Build option | Hourly rate | Hours | Cost range | Quality risk |
| --- | --- | --- | --- | --- |
| Low-cost freelance (overseas) | $25–$50/hr | 1,200–2,000 hrs | **$30K–$100K** | High — likely security gaps, brittle code. |
| Professional freelance (US/EU senior) | $100–$175/hr | 1,000–1,600 hrs | **$100K–$280K** | Medium — depends on whether they have Supabase + Stripe muscle memory. |
| Small agency (3–5 people) | $150–$250/hr | 1,500–2,500 hrs | **$225K–$625K** | Lower technical risk; higher cost; some scope drift. |
| Full commercial SaaS team (PM + designer + 2 eng + QA + ops) | Burdened ≈ $80–$120K/mo | 6–9 months to MVP | **$500K–$1.1M to MVP**, $80–$120K/mo ongoing | Lowest risk; correct shape if the goal is a fundable startup. |

### Recurring run-rate costs
| Item | Cost (small SaaS, < 100 paying orgs) | Cost (mid-scale, 1,000 paying orgs) |
| --- | --- | --- |
| Supabase | $25–$100/mo Pro, scales w/ DB + storage | $400–$1,500/mo team plan + add-ons |
| Vercel | $20/mo Pro | $200–$1,000/mo Enterprise/Edge |
| Resend | $20/mo (50K emails) | $300–$800/mo |
| Stripe (for SaaS billing itself) | 2.9% + $0.30 per charge + $0 platform | Negotiated; ~2.4% |
| Google Maps | $0–$200/mo | **$1K–$5K/mo** (this can become the largest variable cost — needs caching and quotas) |
| Twilio (when SMS added) | $20–$200/mo | $1K–$5K/mo |
| Sentry / monitoring | $0–$30/mo | $100–$500/mo |
| Domain + email | $20/mo | $50/mo |
| **Total infra** | **~$100–$600/mo** | **~$3K–$14K/mo** |
| Support (1 FTE) | — | $4K–$10K/mo (could be founder-led under 100 orgs) |
| Engineering (maintenance + features) | 0.5 FTE | 2–4 FTE |

---

## 18. Revenue Model Options

| Model | Fit for Suds | Notes |
| --- | --- | --- |
| **Monthly subscription, per org** | **Best fit.** | $39 / $99 / $249 tiering matches Section 14. |
| **Annual subscription with 15–20% discount** | Standard SaaS lever. | Improves cash flow + retention. |
| **Per-user pricing** | Optional add-on once Pro+ tier ships crew users. | E.g. "$10/user beyond 3". |
| **Per-crew pricing** | Useful in Premium tier. | "$25/crew beyond 1 crew". |
| **Per-location pricing** | Enterprise. | "$50/location beyond 1". |
| **Setup fee** | Optional for Enterprise to fund onboarding/migration. | $500–$2,500 one-time. |
| **White-label licensing** | A franchise group could license the brand-stripped product. | $5K–$25K/mo + per-seat. |
| **Enterprise licensing** | Annual contracts $10K–$60K. | With SLA + SSO. |
| **Usage-based fees on add-ons** | Pass-through SMS at +20%, Stripe pass-through, Maps pass-through. | Protects margin on heavy users. |
| **Add-on modules** | Sell AI features as a $39–$99/mo add-on regardless of base tier. | Lets you experiment. |
| **Transaction fee on Stripe payments** | A 0.5% take rate on processed invoice volume could materially boost ARPU. | Common in vertical SaaS (Toast, ServiceTitan). |
| **Marketplace** | Future: chemical/equipment supplier partnerships referral fee. | Long-term. |

**Recommended starting model:** monthly subscription, 3 tiers (Basic / Pro / Premium), 14-day trial, 17% annual discount, optional 0.5% transaction fee or include online payments only on Pro+.

---

## 19. Risks / Missing Pieces

### 19.1 Missing core features
- **No way to charge customers for the SaaS itself** — there is no Stripe Billing flow, no plan enforcement, no paywall. This is the single largest blocker to monetization.
- No real PDF export (the `/pdf` routes return HTML).
- No drag-and-drop calendar; only one (week) view.
- No crew permission model; the schema has roles but the app does not enforce them.
- No SMS, even though `customer_reminders.channel` schema implies it.
- No public lead capture / website embed.
- No refunds.
- No recurring invoices / contracts.
- No native mobile app / offline.

### 19.2 Security gaps
- Stripe webhook handler uses anon key + metadata trust. Code comment notes this should be swapped to `SUPABASE_SERVICE_ROLE_KEY`. Currently RLS would block these writes unless an explicit policy exists.
- Public quote/gallery/review pages depend on Postgres RLS policies that are **described in source comments rather than verified in a migrations file** committed to this repo (no `/supabase/migrations` folder is present). A reviewer cannot verify the RLS rules from the code alone.
- 2FA not exposed in UI.
- No CSRF tokens (relies on Same-Site cookies).
- No rate-limiting on public approval / review endpoints.
- No password complexity beyond Supabase default 6-char min.
- No automated dependency scanning / CI.

### 19.3 Scalability / data issues
- The TypeScript `Database` type is **out of date**: code references `customer_reminders`, `review_feedback`, `public_galleries`, `photo_attachments`, `chemical_recipes`, plus extra org fields (`global_min_job_price`, `deposit_threshold`, etc.) and service fields (`material_modifiers`, `is_addon`, etc.) that aren't in the typed file. This works at runtime but produces `as any` casts and removes compile-time safety.
- Dashboard issues ~15 parallel queries per page load. Acceptable for SMB scale but should be monitored.
- Photo signed URLs are valid for **one full year** — convenient but a long blast radius if a token leaks.
- No pagination on customers / invoices / jobs lists once orgs grow past a few hundred rows.
- Google Maps cost scales linearly; without caching of geocodes and a per-org daily quota, a growth spurt could cause runaway billing.

### 19.4 Unfinished code / placeholders
- `src/app/(app)/reports/page.tsx` line 39 contains `supabase.rpc as any, // placeholder removed below` — leftover scaffolding.
- README lists "Photo annotations (schema-ready; UI TODO)" and "Calendar week view (drag-and-drop not yet)".
- `src/lib/receipt-upload.ts` exists but no UI page invokes it (file upload from the expense form is not present).
- No tests, no CI workflow.

### 19.5 UX gaps
- The measurement tool computes sqft per polygon but does not **auto-create** estimate line items from polygons. The owner has to retype.
- Customers list has a search box but no pagination, sorting, or column toggles.
- No undo for any destructive action.
- Many forms have no client-side validation messages.

### 19.6 Missing integrations
- QuickBooks (operators care about it).
- SMS provider.
- Google Calendar 2-way sync.
- Native mobile-app distribution (TestFlight/Play Store).
- Plaid (auto expense import).

### 19.7 Legal / compliance concerns
- No Terms of Service / Privacy Policy / Data Processing Addendum included in repo.
- No cookie consent banner.
- No "delete my account / export my data" flows.
- Tax collection is single-rate per org; no per-jurisdiction support.
- No 1099 / W-2 reporting (only matters once payroll prep exists).

### 19.8 Support burden
- No in-app help / docs / chat widget.
- No tooltip / guided tour / first-run wizard beyond the demo.
- Owner-burden for explaining cron + Vercel cron configuration.

### 19.9 Data backup & resilience
- Inherits Supabase backups, but no in-app self-service export. Customers cannot pull their CSV.
- No `audit_log` to investigate "who changed what when".

### 19.10 Mobile limitations
- Responsive only — no install prompt, no offline cache, no push notifications, no device camera quality optimizations beyond the browser default.

---

## 20. Final Analyst Summary

**What the software is.** Suds is a vertical SaaS that bundles CRM, scheduling, estimating, invoicing, payments, accounting, satellite-image-based property measurement, chemical inventory, equipment tracking, lead pipeline, marketing campaign tracking, and automated reminder/review flows for **pressure washing companies**. It is built on Next.js 14 + Supabase + Stripe + Resend + Google Maps + Google Drive, fully multi-tenant, mobile-responsive, and ships with a one-click anonymous demo.

**How mature it appears.** **Mid-stage MVP.** The "money path" — customer → estimate → digital approval → job → photos → invoice → Stripe link → webhook auto-payment → emailed receipt → review request — is implemented end-to-end and integrated with real third-party services. Roughly 90 source files, ~5K lines of TypeScript, and 24+ Postgres tables back the product. The single most polished idea is the **Workflow Stepper / Next-Step Banner** that turns the entire customer lifecycle into a one-click-per-step ladder. The product is **not yet sellable as-is** because there is no SaaS billing layer (no paywall, no plan enforcement) and no real PDF export.

**What type of customer it fits.** Solo owner-operators and 2–4-truck pressure washing companies that today are running on Square + spreadsheets + texts, or paying $80–$200/mo for general FSM tools (Jobber, Housecall Pro) that don't understand pressure washing.

**What features drive the most value.**
1. The integrated workflow + auto-billing + auto-receipt pipeline.
2. Stripe-link invoicing with webhook auto-recording.
3. Satellite polygon measurement.
4. Pressure-washing-specific data model (chemicals, mix calculator, height/material modifiers, hazard class, SDS).
5. Smart auto-review router (1–3 stars private, 4–5 to Google).
6. Email reminders for appointments + recurring service intervals.
7. Demo mode with rich seed data — strong sales-enablement asset.

**What features are incomplete.**
- SaaS subscription billing (must build).
- Real PDF export (must build).
- Crew/dispatch role separation (schema-ready; UI missing).
- Drag-and-drop calendar (only week view).
- SMS channel.
- Public lead capture form.
- Refunds, recurring invoices, time clock, payroll prep.
- Native mobile app, offline support.
- Auto-build line items from saved measurement polygons (workflow gap).
- Audit log, 2FA, super-admin console.
- TypeScript schema file is out of sync with live DB (technical debt).

**What pricing tiers seem logical.**
- **Basic** $29–$49/mo — solo operator. Core money path.
- **Pro** $79–$129/mo — multi-user crew, satellite measure, chemicals, equipment, marketing, SMS, recurring invoices, QuickBooks export.
- **Premium** $199–$349/mo — multi-truck, route optimization, native crew app, AI features, bank feed, white-label customer portal, time clock.
- **Enterprise** $599+/mo or annual — multi-location, SSO, API, audit, SLA.

**What information still needs to be answered before final pricing.**
1. **Total addressable market estimate**: how many US pressure washing businesses are there in each segment (solo / 2–4 truck / 5–10 truck)? Industry sources suggest 30K–100K active US operators; tier-mix unknown.
2. **Stripe transaction volume per org**: is a 0.5% take rate or a SMS pass-through margin meaningful? Need a survey of existing operators' average annual processed volume.
3. **Willingness to pay**: what do current Jobber Lite / Housecall Pro Basic customers currently pay, and what is their churn / NPS? This determines whether Suds prices below or at parity.
4. **Sales motion**: self-serve trial vs. founder-led demo? Affects how heavily to invest in onboarding wizard and live chat vs. video tutorials.
5. **Cost of Maps + photo storage at scale**: needs a cost model assuming X measurements/day and Y photos/job to avoid margin surprises in Premium tier.
6. **Branding / channel strategy**: are pressure washing trade Facebook groups (PWRA, etc.) the GTM channel? Affects acquisition cost and tier mix.
7. **Decision on monetization model**: pure subscription vs. subscription + payments take rate vs. subscription + add-ons. Each materially changes ARPU and CAC payback.
8. **Roadmap urgency**: is the priority depth (perfect the existing modules) or breadth (ship dispatch, SMS, AI quickly)? Determines next 6 months of investment.

**Summary recommendation for the analyst.** Treat this as a viable mid-stage MVP whose **technical core is approximately 60–75% of an MVP-ready commercial product**. Build cost to date is consistent with a $100K–$280K freelance build or a $400K+ small-team build. Three immediate gates separate it from billable: (a) Stripe Billing for the SaaS itself, (b) real PDF export, (c) crew permission enforcement. With those closed, conservative tier pricing of **$39 / $99 / $249** plus a 0.5% transaction fee on Stripe-processed invoices yields a defensible vertical-SaaS price point that undercuts Jobber/Housecall Pro by 20–40% while shipping pressure-washing-native features they don't have.
