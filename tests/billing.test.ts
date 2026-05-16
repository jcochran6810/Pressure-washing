// Example unit test for the billing helpers — pure functions, no DB needed.
// Run with: npm test
// This file is the template; mirror its shape when adding tests for other pure logic.

import { describe, it, expect } from "vitest";
import {
  isSubscriptionActive,
  isSubscriptionRestricted,
  daysLeftInTrial,
  subscriptionBanner,
} from "@/lib/billing";

function inDays(d: number) {
  return new Date(Date.now() + d * 24 * 60 * 60 * 1000).toISOString();
}

describe("isSubscriptionActive", () => {
  it("returns true for an active subscription", () => {
    expect(isSubscriptionActive({ subscription_status: "active" })).toBe(true);
  });

  it("returns true for a trial that hasn't ended yet", () => {
    expect(
      isSubscriptionActive({
        subscription_status: "trialing",
        trial_ends_at: inDays(7),
      }),
    ).toBe(true);
  });

  it("returns false for a trial that has ended", () => {
    expect(
      isSubscriptionActive({
        subscription_status: "trialing",
        trial_ends_at: inDays(-1),
      }),
    ).toBe(false);
  });

  it("returns false for past_due", () => {
    expect(isSubscriptionActive({ subscription_status: "past_due" })).toBe(false);
  });

  it("returns false for cancelled", () => {
    expect(isSubscriptionActive({ subscription_status: "cancelled" })).toBe(false);
  });

  it("returns false when org is null", () => {
    expect(isSubscriptionActive(null)).toBe(false);
  });
});

describe("isSubscriptionRestricted", () => {
  it("is the inverse of isSubscriptionActive", () => {
    const cases = [
      { subscription_status: "active" },
      { subscription_status: "trialing", trial_ends_at: inDays(5) },
      { subscription_status: "trialing", trial_ends_at: inDays(-1) },
      { subscription_status: "past_due" },
      { subscription_status: "cancelled" },
    ];
    for (const c of cases) {
      expect(isSubscriptionRestricted(c)).toBe(!isSubscriptionActive(c));
    }
  });
});

describe("daysLeftInTrial", () => {
  it("returns null outside of a trial", () => {
    expect(daysLeftInTrial({ subscription_status: "active" })).toBeNull();
  });
  it("rounds up partial days", () => {
    const halfDay = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
    expect(
      daysLeftInTrial({ subscription_status: "trialing", trial_ends_at: halfDay }),
    ).toBe(1);
  });
  it("returns 0 once the trial is over", () => {
    expect(
      daysLeftInTrial({
        subscription_status: "trialing",
        trial_ends_at: inDays(-1),
      }),
    ).toBe(0);
  });
});

describe("subscriptionBanner", () => {
  it("returns null during a healthy trial with > 3 days left", () => {
    const b = subscriptionBanner({
      subscription_status: "trialing",
      trial_ends_at: inDays(7),
    });
    expect(b).toBeNull();
  });

  it("warns when trial has 3 or fewer days left", () => {
    const b = subscriptionBanner({
      subscription_status: "trialing",
      trial_ends_at: inDays(2),
    });
    expect(b?.tone).toBe("warning");
    expect(b?.ctaHref).toBe("/billing");
  });

  it("shows an error when past_due", () => {
    const b = subscriptionBanner({ subscription_status: "past_due" });
    expect(b?.tone).toBe("error");
    expect(b?.title.toLowerCase()).toContain("payment failed");
  });

  it("shows an error when cancelled", () => {
    const b = subscriptionBanner({ subscription_status: "cancelled" });
    expect(b?.tone).toBe("error");
  });
});
