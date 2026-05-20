// Per-trade feature flags that drive which sidebar links the org sees.
// Direct URLs still work — this is for UI clutter, not authorization. A
// chemicals-tracking org that wants to peek at /mix can still type it in.
//
// Universal features (Customers, Estimates, Invoices, Jobs, Settings,
// Calendar, etc.) aren't keyed here — they show for every trade.
// Only the trade-specific ones live in this map.

export type TradeFeature =
  | "chemicals"     // Chemical inventory + recipes (cleaning chemistry)
  | "mix_calc"     // Mix-by-ratio calculator (also cleaning-chemistry)
  | "measure"       // Roof / surface measurement tool
  | "equipment"     // Equipment + service-schedule tracking
  | "recurring"     // Recurring-job scheduler (route-based services)
  | "mulch_calc"    // Cubic-yard mulch / soil calculator (placeholder for future)
  ;

// Anything a trade enables here will appear in the sidebar for that trade.
// A multi-trade org gets the union — see featuresFor() below.
const TRADE_FEATURES: Record<string, TradeFeature[]> = {
  pressure_washing: ["chemicals", "mix_calc", "measure", "equipment", "recurring"],
  lawn_care: ["equipment", "recurring", "measure"],
  landscaping: ["equipment", "measure", "mulch_calc"],
  house_cleaning: ["recurring"],
  window_cleaning: ["equipment", "recurring"],
  gutter_cleaning: ["equipment", "measure"],
  painting: ["equipment", "measure"],
  handyman: ["equipment"],
  hvac: ["equipment"],
  plumbing: ["equipment"],
  electrical: ["equipment"],
  pool_service: ["chemicals", "equipment", "recurring"],
  pest_control: ["chemicals", "recurring"],
  junk_removal: ["equipment"],
  carpet_cleaning: ["chemicals", "equipment"],
  mobile_detailing: ["chemicals", "equipment"],
  roofing: ["measure", "equipment"],
  appliance_repair: [],
  dryer_vent: ["equipment"],
  holiday_lights: ["measure", "recurring"],
  general_home: ["equipment"],

  tree_service: ["equipment", "measure"],
  fencing: ["measure"],
  snow_removal: ["equipment", "recurring"],
  garage_door: [],
  concrete: ["measure", "equipment"],
  irrigation: ["equipment"],
  epoxy_flooring: ["measure"],
  solar_install: ["measure", "equipment"],
  chimney_sweep: ["equipment", "recurring"],
};

export function featuresFor(tradeIds: string[]): Set<TradeFeature> {
  const out = new Set<TradeFeature>();
  for (const id of tradeIds) {
    for (const f of TRADE_FEATURES[id] ?? []) out.add(f);
  }
  return out;
}

export function hasFeature(tradeIds: string[], feature: TradeFeature): boolean {
  return tradeIds.some((id) => (TRADE_FEATURES[id] ?? []).includes(feature));
}
