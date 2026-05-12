// IRS Schedule C (Form 1040) line definitions + an auto-mapper that takes
// the org's free-form expense category names and routes them to the right
// Schedule C line. Anything that doesn't match a keyword falls into
// Line 27a "Other expenses" so nothing is silently dropped.
//
// This is a starting-point classification — a CPA should review before
// filing. The export page makes the mapping visible per line so the
// owner / CPA can sanity-check it.

export type ScheduleCLine = {
  line: string; // "8", "9", "20a", "27a", etc.
  label: string;
  part: "I" | "II" | "III";
  /** True if this line is computed by the system rather than mapped from expenses. */
  computed?: boolean;
};

export const SCHEDULE_C_LINES: ScheduleCLine[] = [
  // Part I (Income) — populated from payments
  { line: "1", label: "Gross receipts or sales", part: "I", computed: true },
  { line: "4", label: "Cost of goods sold", part: "I", computed: true },
  { line: "7", label: "Gross income", part: "I", computed: true },

  // Part II (Expenses) — populated from expenses table
  { line: "8", label: "Advertising", part: "II" },
  { line: "9", label: "Car and truck expenses", part: "II" },
  { line: "10", label: "Commissions and fees", part: "II" },
  { line: "11", label: "Contract labor", part: "II" },
  { line: "13", label: "Depreciation and section 179", part: "II", computed: true },
  { line: "14", label: "Employee benefit programs", part: "II" },
  { line: "15", label: "Insurance (other than health)", part: "II" },
  { line: "16a", label: "Mortgage interest", part: "II" },
  { line: "16b", label: "Other interest", part: "II" },
  { line: "17", label: "Legal and professional services", part: "II" },
  { line: "18", label: "Office expense", part: "II" },
  { line: "19", label: "Pension and profit-sharing plans", part: "II" },
  { line: "20a", label: "Rent — vehicles, machinery, equipment", part: "II" },
  { line: "20b", label: "Rent — other business property", part: "II" },
  { line: "21", label: "Repairs and maintenance", part: "II" },
  { line: "22", label: "Supplies", part: "II" },
  { line: "23", label: "Taxes and licenses", part: "II" },
  { line: "24a", label: "Travel", part: "II" },
  { line: "24b", label: "Deductible meals", part: "II" },
  { line: "25", label: "Utilities", part: "II" },
  { line: "26", label: "Wages (less employment credits)", part: "II" },
  { line: "27a", label: "Other expenses", part: "II" },
];

export const SCHEDULE_C_LINE_BY_KEY = new Map(SCHEDULE_C_LINES.map((l) => [l.line, l]));

const RULES: Array<[RegExp, string]> = [
  [/advertis|marketing|ad ?spend|google ?ads|facebook ?ads|seo|signage|yard ?sign|business ?card/i, "8"],
  [/fuel|\bgas\b|gasoline|diesel|vehicle|truck|car ?wash|tolls|parking|registration tag|tire/i, "9"],
  [/commission|referral fee/i, "10"],
  [/subcontract|contract ?labor|1099|day labor|temp labor|helper pay/i, "11"],
  [/health insurance|hsa|401k|retirement|employee benefit/i, "14"],
  [/insurance|liability|workers ?comp|umbrella policy|policy premium/i, "15"],
  [/mortgage interest|home loan interest/i, "16a"],
  [/loan interest|line of credit interest|interest expense/i, "16b"],
  [/legal|attorney|accountant|cpa|bookkeep|professional fee/i, "17"],
  [/office|stationery|paper|printer|toner|software|saas|subscription|computer|laptop|app fee/i, "18"],
  [/pension|profit ?sharing|sep ira/i, "19"],
  [/equipment rent|machinery rent|tool rent|vehicle rent|truck rent/i, "20a"],
  [/rent|lease|warehouse|storage unit|shop space|yard space/i, "20b"],
  [/repair|maintenance|fix |service charge|tune ?up|oil change/i, "21"],
  [/suppl|chemical|sh |sodium|surfactant|soap|detergent|hose|nozzle|wand|pressure ?tip|fitting|consumable/i, "22"],
  [/\btax\b|license|permit/i, "23"],
  [/travel|hotel|airfare|lodging|mileage|airbnb/i, "24a"],
  [/\bmeal\b|lunch|dinner|breakfast|restaurant|coffee/i, "24b"],
  [/utility|electric|water|internet|phone|cellular|\bcell\b/i, "25"],
  [/wage|payroll|\bemployee\b(?! benefit)|w-?2 salary|salary/i, "26"],
];

/**
 * Best-effort mapping of a free-form category/vendor/description string to a
 * Schedule C line. Returns line "27a" (Other expenses) when nothing matches.
 */
export function mapToScheduleC(label: string | null | undefined): ScheduleCLine {
  const s = (label ?? "").trim();
  if (s) {
    for (const [re, line] of RULES) {
      if (re.test(s)) return SCHEDULE_C_LINE_BY_KEY.get(line)!;
    }
  }
  return SCHEDULE_C_LINE_BY_KEY.get("27a")!;
}

/**
 * Given an expense row (with .expense_categories.name, .vendor, .description),
 * return the Schedule C line by checking the category name first, then the
 * vendor, then the description.
 */
export function mapExpenseRowToScheduleC(row: {
  expense_categories?: { name?: string | null } | null;
  vendor?: string | null;
  description?: string | null;
}): ScheduleCLine {
  const cat = row.expense_categories?.name;
  if (cat) {
    const m = mapToScheduleC(cat);
    if (m.line !== "27a") return m;
  }
  if (row.vendor) {
    const m = mapToScheduleC(row.vendor);
    if (m.line !== "27a") return m;
  }
  if (row.description) {
    const m = mapToScheduleC(row.description);
    if (m.line !== "27a") return m;
  }
  return SCHEDULE_C_LINE_BY_KEY.get("27a")!;
}
