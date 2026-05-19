// Tier 1 tests — financial correctness.
// Run with: npm test

import { describe, it, expect } from "vitest";
import {
  applyPayment,
  computeDocumentTotals,
  computeDeposit,
  classifyAccessLevel,
} from "@/lib/money";

describe("applyPayment", () => {
  it("records a first partial payment", () => {
    const r = applyPayment({
      current_total: 460.06,
      current_amount_paid: 0,
      payment_amount: 200,
      current_status: "sent",
    });
    expect(r.new_amount_paid).toBe(200);
    expect(r.new_balance_due).toBe(260.06);
    expect(r.new_status).toBe("partial");
  });

  it("marks paid when balance hits exactly zero", () => {
    const r = applyPayment({
      current_total: 460.06,
      current_amount_paid: 200,
      payment_amount: 260.06,
      current_status: "partial",
    });
    expect(r.new_amount_paid).toBe(460.06);
    expect(r.new_balance_due).toBe(0);
    expect(r.new_status).toBe("paid");
  });

  it("caps balance at 0 on overpayment", () => {
    const r = applyPayment({
      current_total: 100,
      current_amount_paid: 0,
      payment_amount: 150,
      current_status: "sent",
    });
    expect(r.new_amount_paid).toBe(150);
    expect(r.new_balance_due).toBe(0);
    expect(r.new_status).toBe("paid");
  });

  it("handles a zero-total invoice without flipping to paid", () => {
    const r = applyPayment({
      current_total: 0,
      current_amount_paid: 0,
      payment_amount: 0,
      current_status: "draft",
    });
    expect(r.new_status).toBe("draft");
  });

  it("does not lose precision across multiple partial payments", () => {
    let total = 100;
    let paid = 0;
    let status = "sent";
    for (const amt of [33.33, 33.33, 33.34]) {
      const r = applyPayment({ current_total: total, current_amount_paid: paid, payment_amount: amt, current_status: status });
      paid = r.new_amount_paid;
      status = r.new_status;
    }
    expect(paid).toBe(100);
    expect(status).toBe("paid");
  });

  it("returns numbers, not strings (regression test)", () => {
    const r = applyPayment({
      current_total: 50,
      current_amount_paid: 0,
      payment_amount: 25,
      current_status: "sent",
    });
    expect(typeof r.new_amount_paid).toBe("number");
    expect(typeof r.new_balance_due).toBe("number");
  });
});

describe("computeDocumentTotals", () => {
  it("computes subtotal/tax/total", () => {
    const r = computeDocumentTotals(
      [{ quantity: 1, unit_price: 575 }, { quantity: 1, unit_price: 350 }],
      { tax_rate: 0.0825 },
    );
    expect(r.subtotal).toBe(925);
    expect(r.tax_amount).toBe(76.31);
    expect(r.total).toBe(1001.31);
  });

  it("applies discount before tax", () => {
    const r = computeDocumentTotals(
      [{ quantity: 2, unit_price: 50 }],
      { discount: 10, tax_rate: 0.1 },
    );
    expect(r.subtotal).toBe(100);
    expect(r.discount).toBe(10);
    expect(r.tax_amount).toBe(9); // (100 - 10) * 0.10
    expect(r.total).toBe(99);
  });

  it("handles empty items", () => {
    const r = computeDocumentTotals([], { tax_rate: 0.0825 });
    expect(r.subtotal).toBe(0);
    expect(r.total).toBe(0);
  });

  it("treats discount > subtotal as cap at 0", () => {
    const r = computeDocumentTotals(
      [{ quantity: 1, unit_price: 50 }],
      { discount: 100, tax_rate: 0.1 },
    );
    expect(r.subtotal).toBe(50);
    expect(r.tax_amount).toBe(0);
    expect(r.total).toBe(0);
  });

  it("rounds to two decimals (no float drift)", () => {
    const r = computeDocumentTotals(
      [{ quantity: 3, unit_price: 33.33 }],
      { tax_rate: 0.07 },
    );
    expect(r.subtotal).toBe(99.99);
    expect(r.tax_amount).toBe(7); // 99.99 * 0.07 = 6.9993 → 7.00
    expect(r.total).toBe(106.99);
  });

  it("handles fractional quantities (sqft pricing)", () => {
    const r = computeDocumentTotals(
      [{ quantity: 1200.5, unit_price: 0.15 }],
      { tax_rate: 0 },
    );
    expect(r.subtotal).toBe(180.08);
  });

  it("excludes non-taxable lines from the tax base", () => {
    // Labor often isn't taxed in mixed jurisdictions; materials are.
    // $500 labor (non-taxable) + $200 materials (taxable) at 10% should
    // tax only the $200, not the $700.
    const r = computeDocumentTotals(
      [
        { quantity: 1, unit_price: 500, taxable: false, kind: "labor" },
        { quantity: 1, unit_price: 200, taxable: true, kind: "material" },
      ],
      { tax_rate: 0.1 },
    );
    expect(r.subtotal).toBe(700);
    expect(r.taxable_subtotal).toBe(200);
    expect(r.tax_amount).toBe(20);
    expect(r.total).toBe(720);
    expect(r.labor_subtotal).toBe(500);
    expect(r.materials_subtotal).toBe(200);
  });

  it("treats undefined taxable as true (back-compat)", () => {
    // Pre-existing line rows have no taxable field; they must continue
    // to behave exactly like the old single-rate model.
    const r = computeDocumentTotals(
      [{ quantity: 1, unit_price: 100 }, { quantity: 1, unit_price: 50 }],
      { tax_rate: 0.08 },
    );
    expect(r.taxable_subtotal).toBe(150);
    expect(r.tax_amount).toBe(12);
    expect(r.total).toBe(162);
  });

  it("pro-rates the discount across taxable and non-taxable lines", () => {
    // $100 taxable + $100 non-taxable = $200 subtotal. A $50 discount
    // should remove $25 from the taxable base (not the whole $50) so
    // tax computes on $75, not $50.
    const r = computeDocumentTotals(
      [
        { quantity: 1, unit_price: 100, taxable: true, kind: "material" },
        { quantity: 1, unit_price: 100, taxable: false, kind: "labor" },
      ],
      { discount: 50, tax_rate: 0.1 },
    );
    expect(r.subtotal).toBe(200);
    expect(r.taxable_subtotal).toBe(75);
    expect(r.tax_amount).toBe(7.5);
    expect(r.total).toBe(157.5); // 200 − 50 + 7.50
  });

  it("only rolls up kind subtotals for labor / material (not service / other)", () => {
    const r = computeDocumentTotals(
      [
        { quantity: 1, unit_price: 100, kind: "service" },
        { quantity: 1, unit_price: 50, kind: "other" },
        { quantity: 1, unit_price: 25, kind: "labor" },
      ],
      { tax_rate: 0 },
    );
    expect(r.subtotal).toBe(175);
    expect(r.labor_subtotal).toBe(25);
    expect(r.materials_subtotal).toBe(0);
  });
});

describe("computeDeposit", () => {
  it("returns null below threshold", () => {
    expect(computeDeposit(500, { deposit_threshold: 1000 })).toBeNull();
  });
  it("returns 25% above threshold by default", () => {
    expect(computeDeposit(2000, { deposit_threshold: 1000 })).toBe(500);
  });
  it("respects custom percentage", () => {
    expect(computeDeposit(2000, { deposit_threshold: 1000, deposit_percentage: 0.5 })).toBe(1000);
  });
  it("returns null when threshold is 0 or unset (disabled)", () => {
    expect(computeDeposit(5000, {})).toBeNull();
    expect(computeDeposit(5000, { deposit_threshold: 0 })).toBeNull();
  });
});

describe("classifyAccessLevel", () => {
  const future = new Date(Date.now() + 7 * 86400_000).toISOString();
  const past = new Date(Date.now() - 86400_000).toISOString();

  it("active = active", () => {
    expect(classifyAccessLevel({ status: "active" })).toBe("active");
  });
  it("trialing within window is trialing_active", () => {
    expect(classifyAccessLevel({ status: "trialing", trial_ends_at: future })).toBe("trialing_active");
  });
  it("trialing past window is trial_expired", () => {
    expect(classifyAccessLevel({ status: "trialing", trial_ends_at: past })).toBe("trial_expired");
  });
  it("past_due is restricted", () => {
    expect(classifyAccessLevel({ status: "past_due" })).toBe("restricted");
  });
  it("cancelled is restricted", () => {
    expect(classifyAccessLevel({ status: "cancelled" })).toBe("restricted");
  });
  it("null is restricted", () => {
    expect(classifyAccessLevel({ status: null })).toBe("restricted");
  });
});
