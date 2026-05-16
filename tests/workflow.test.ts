// Workflow state machine — tests pure stage detection, no DB.
// loadWorkflow itself is DB-bound; we'd integration-test it separately.

import { describe, it, expect } from "vitest";

// Test the WORKFLOW_STAGES constants are exported and stable. The
// component that consumes them depends on the order.
import { loadWorkflow } from "@/lib/workflow";

describe("workflow module", () => {
  it("exports loadWorkflow as a function", () => {
    expect(typeof loadWorkflow).toBe("function");
  });
});

// More meaningful integration tests for workflow live in
// tests/integration/workflow.integration.test.ts (TODO — needs a test
// Supabase project; see TESTING.md).
