# Testing plan

The app is wired with **Vitest**. Run with:

```bash
npm test          # one-shot
npm run test:watch # rerun on change
npm run test:ui   # browser UI
```

Test files live under `tests/`. Two example tests are already in place:

- `tests/billing.test.ts` — subscription helpers (pure functions)
- `tests/workflow.test.ts` — workflow module sanity check

## What to test, in order of priority

The app handles money. Bugs in financial logic cost real customers real money, which is the fastest way to lose trust and get sued. So: test the money path first, polish second.

### Tier 1 — financial correctness (do these BEFORE customer #10)

1. **Invoice payment math** (`src/app/(app)/invoices/actions.ts:recordPayment`)
   - Partial payments correctly compute `amount_paid`, `balance_due`, `status`
   - Over-payments cap balance_due at 0 (don't go negative)
   - Status transitions: draft → sent → partial → paid
   - Tax rounding doesn't accumulate drift

2. **Estimate → invoice conversion** (`convertEstimateToInvoice`)
   - All line items copied with `total = qty × unit_price`
   - Tax + discount preserved
   - The estimate status flips to `converted`
   - A job is created and linked if one didn't exist

3. **Stripe webhook → payment recording** (`api/stripe/webhook/route.ts`)
   - Signature verification rejects forged events
   - `checkout.session.completed` for a one-off invoice payment records correctly
   - `invoice.paid` for a Stripe subscription on a connected account credits the right customer
   - SaaS `invoice.payment_failed` sets `subscription_status=past_due`
   - Idempotency: receiving the same event twice does NOT double-record (Stripe retries on webhook failure)

4. **Subscription guard** (`getSessionAndOrgForMutation`)
   - Throws `SubscriptionRequiredError` for past_due / cancelled
   - Allows trialing within trial window
   - Allows trialing → access blocked once trial expires

5. **Tax form math** (`api/tax/schedule-c.csv`, `api/tax/1099-nec.csv`)
   - Schedule C totals match the page totals
   - 1099-NEC threshold of $600 is enforced
   - Year boundary cases (Dec 31 vs Jan 1)

### Tier 2 — workflow integrity

6. **Contract recurring logic** (`runDueContracts` + `advanceMonths`)
   - `next_run_date` advances by `cadence_months` after each run
   - `preferred_day` correctly clamps to 1–28
   - Contracts past `end_date` flip to `expired`
   - Auto-generated estimates copy the service template correctly
   - Two simultaneous calls don't double-run (atomic claim or unique constraint)

7. **Chemical auto-deduct on job completion** (`applyJobChemicalUsage`)
   - Pending usage rows convert to `chemical_transactions` and decrement `current_stock`
   - Stock can't go below 0
   - Low-stock notification fires at/below `reorder_level`
   - Marking the job completed twice doesn't deduct twice

8. **Job → invoice auto-draft** (`setJobStatus` with `status=completed`)
   - First completion creates a draft invoice from the linked estimate
   - Second completion doesn't create a duplicate invoice
   - Job total without an estimate produces a one-line invoice

### Tier 3 — public flows

9. **Public quote approval** (`accept_estimate_by_token` RPC)
   - Approving creates a scheduled job if none exists
   - Already-responded estimates fail loudly
   - Expired estimates fail loudly

10. **Public waiver signing** (`waiver/[token]/actions.ts`)
    - Cannot sign already-signed or declined waivers
    - IP and user-agent are captured

11. **Customer portal token validation** (`api/portal/verify`)
    - Expired tokens redirect to login
    - Invalid tokens redirect to login
    - Valid tokens set cookie and load portal

### Tier 4 — UI / integration

12. **Workflow stepper** state transitions
13. **Auto-save** restoration on page reload
14. **Notification mark-as-read** updates the unread count

## Test categories

### Unit tests (Vitest, no DB) — ~30 tests total

Run on every PR. Fast.
- All pure helpers in `lib/` (billing, workflow, validation, utils, csv, message-templates)
- Tax math
- Form parsing
- Date helpers

Example: `tests/billing.test.ts` — copy its shape.

### Integration tests (Vitest + test Supabase project) — ~15 tests total

Run on PR-to-main. Slower (network).
- Create a separate **Supabase staging project** (free tier).
- Set `SUPABASE_TEST_URL` + `SUPABASE_TEST_SERVICE_ROLE_KEY` env vars.
- Each test wraps work in a transaction or cleans up afterward.
- Don't test against production. Ever.

```ts
// tests/integration/invoice-payment.integration.test.ts
import { createClient } from "@supabase/supabase-js";
import { beforeAll, describe, it, expect } from "vitest";

const supabase = createClient(
  process.env.SUPABASE_TEST_URL!,
  process.env.SUPABASE_TEST_SERVICE_ROLE_KEY!,
);

describe("invoice payment", () => {
  let orgId: string, custId: string, invId: string;
  beforeAll(async () => {
    // ... seed an org, customer, invoice for $100
  });
  it("partial payment moves status to partial", async () => {
    // call recordPayment via the action's internals, or via fetch
    // assert status='partial', balance_due=50
  });
});
```

### End-to-end tests (Playwright) — defer

Once you have 10 paying customers, add a smoke test that runs nightly:

1. Sign in
2. Create a customer
3. Create an estimate
4. Send via SMS or email (use test mode for both providers)
5. Approve the estimate
6. Verify job created

This catches regressions in the full stack. Not worth setting up before customer #10.

## CI integration

The `.github/workflows/ci.yml` runs `typecheck`, `lint`, and `build` on every PR.
Add `test` to the workflow once you have meaningful tests:

```yaml
- run: npm test
```

## Coverage goals

- Tier 1 financial logic: **80%+ coverage**
- Tier 2 workflow: **60%+ coverage**
- Tier 3 public flows: **integration tests over unit (real DB)**
- UI: optional — don't chase a number, test behaviors

Vitest can report coverage via `vitest --coverage`.

## What NOT to test

- Don't test framework code (Next.js routing, Supabase SDK, Stripe SDK)
- Don't test that React components render — only test their behavior when input changes
- Don't test generated types (`database.ts`)
- Don't test simple CRUD that's just `supabase.from(x).select()`. The cost-benefit is bad.

## Suggested order to write tests in

Week 1: write 8 tests for Tier 1 #1–5 (financial)
Week 2: write 5 tests for Tier 2 #6–8 (workflow)
Week 3: add Supabase staging project, write 3 integration tests for Tier 3
Week 4+: maintenance — add a test for every bug you fix

Don't aim for "tests written" — aim for "would catch the bug if it regressed."
