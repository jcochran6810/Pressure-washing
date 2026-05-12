// Equipment depreciation for the Schedule C tax export.
//
// Two methods are supported here:
//   straight_line — equal annual write-down over a useful life
//                   (full-year convention; year placed-in-service counts
//                   as the first full year). CPA can shift to half-year
//                   or MACRS in their software if needed.
//   section_179   — full cost expensed in the year placed in service.
//                   (Eligibility is subject to IRS limits — the CPA
//                   should confirm.)
//
// This is a pragmatic export aid, not a tax compliance engine.

export type DepreciationMethod = "straight_line" | "section_179";

export type EquipmentRow = {
  id: string;
  name: string;
  purchase_date?: string | null;
  purchase_price?: number | null;
  current_value?: number | null;
  // Optional schema fields — present if the org has run the suggested
  // migration. Defaults are applied when missing.
  useful_life_years?: number | null;
  depreciation_method?: DepreciationMethod | null;
  salvage_value?: number | null;
};

export type DepreciationResult = {
  equipmentId: string;
  name: string;
  cost: number;
  salvage: number;
  placedInService: Date | null;
  method: DepreciationMethod;
  usefulLifeYears: number;
  yearDepreciation: number;     // for the requested tax year
  accumDepreciation: number;    // through end of requested year
  remainingBasis: number;
  notes?: string;
};

const DEFAULT_LIFE = 5;

export function computeDepreciation(eq: EquipmentRow, forYear: number): DepreciationResult {
  const cost = Number(eq.purchase_price ?? 0);
  const salvage = Number(eq.salvage_value ?? 0);
  const life = Math.max(1, Number(eq.useful_life_years ?? DEFAULT_LIFE));
  const method = (eq.depreciation_method ?? "straight_line") as DepreciationMethod;
  const placedInService = eq.purchase_date ? new Date(eq.purchase_date) : null;
  const placedYear = placedInService?.getFullYear() ?? null;

  // No basis -> nothing to depreciate.
  if (cost <= 0 || !placedYear) {
    return {
      equipmentId: eq.id,
      name: eq.name,
      cost,
      salvage,
      placedInService,
      method,
      usefulLifeYears: life,
      yearDepreciation: 0,
      accumDepreciation: 0,
      remainingBasis: cost,
      notes: cost <= 0 ? "No cost basis recorded" : "No purchase date recorded",
    };
  }

  // Section 179 — full expense in year placed in service.
  if (method === "section_179") {
    if (forYear === placedYear) {
      return {
        equipmentId: eq.id,
        name: eq.name,
        cost,
        salvage,
        placedInService,
        method,
        usefulLifeYears: 1,
        yearDepreciation: cost,
        accumDepreciation: cost,
        remainingBasis: 0,
      };
    }
    return {
      equipmentId: eq.id,
      name: eq.name,
      cost,
      salvage,
      placedInService,
      method,
      usefulLifeYears: 1,
      yearDepreciation: 0,
      accumDepreciation: forYear > placedYear ? cost : 0,
      remainingBasis: 0,
    };
  }

  // Straight-line, full-year convention.
  const annual = Math.max(0, (cost - salvage) / life);
  if (forYear < placedYear) {
    return {
      equipmentId: eq.id,
      name: eq.name,
      cost,
      salvage,
      placedInService,
      method,
      usefulLifeYears: life,
      yearDepreciation: 0,
      accumDepreciation: 0,
      remainingBasis: cost,
    };
  }
  const yearsCompleted = forYear - placedYear + 1; // include current year
  const yearsCapped = Math.min(yearsCompleted, life);
  const accum = Math.min(annual * yearsCapped, cost - salvage);
  const inLife = forYear - placedYear < life;
  return {
    equipmentId: eq.id,
    name: eq.name,
    cost,
    salvage,
    placedInService,
    method,
    usefulLifeYears: life,
    yearDepreciation: inLife ? annual : 0,
    accumDepreciation: accum,
    remainingBasis: Math.max(salvage, cost - accum),
  };
}

export function totalYearDepreciation(rows: DepreciationResult[]): number {
  return rows.reduce((s, r) => s + r.yearDepreciation, 0);
}
