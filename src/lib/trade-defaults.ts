// Per-trade default service catalog used to seed a fresh org's `services` table
// when the operator picks a business type. Keeping this in code (not the DB)
// means we can iterate on copy and pricing without a migration each time.

export type DefaultService = {
  name: string;
  description?: string;
  default_price: number;
  pricing_unit: string;
  category: string;
};

const PRESSURE_WASHING: DefaultService[] = [
  { name: "Driveway cleaning", default_price: 175, pricing_unit: "flat", category: "Exterior cleaning" },
  { name: "Sidewalk cleaning", default_price: 0.25, pricing_unit: "sq_ft", category: "Exterior cleaning" },
  { name: "House wash", default_price: 350, pricing_unit: "flat", category: "Exterior cleaning" },
  { name: "Roof soft wash", default_price: 0.45, pricing_unit: "sq_ft", category: "Exterior cleaning" },
  { name: "Patio cleaning", default_price: 0.30, pricing_unit: "sq_ft", category: "Exterior cleaning" },
  { name: "Deck cleaning", default_price: 0.50, pricing_unit: "sq_ft", category: "Exterior cleaning" },
  { name: "Fence cleaning", default_price: 1.25, pricing_unit: "linear_ft", category: "Exterior cleaning" },
  { name: "Gutter brightening", default_price: 1.50, pricing_unit: "linear_ft", category: "Exterior cleaning" },
];

const LAWN_CARE: DefaultService[] = [
  { name: "Mowing", default_price: 45, pricing_unit: "visit", category: "Maintenance" },
  { name: "Edging", default_price: 15, pricing_unit: "visit", category: "Maintenance" },
  { name: "Weed eating", default_price: 20, pricing_unit: "visit", category: "Maintenance" },
  { name: "Leaf cleanup", default_price: 95, pricing_unit: "flat", category: "Seasonal" },
  { name: "Hedge trimming", default_price: 75, pricing_unit: "hour", category: "Maintenance" },
  { name: "Mulch installation", default_price: 80, pricing_unit: "cubic_yard", category: "Landscape" },
  { name: "Weed control", default_price: 65, pricing_unit: "flat", category: "Treatment" },
  { name: "Seasonal cleanup", default_price: 175, pricing_unit: "flat", category: "Seasonal" },
];

const LANDSCAPING: DefaultService[] = [
  { name: "Landscape design consultation", default_price: 150, pricing_unit: "hour", category: "Design" },
  { name: "Flower bed installation", default_price: 18, pricing_unit: "sq_ft", category: "Install" },
  { name: "Mulch installation", default_price: 80, pricing_unit: "cubic_yard", category: "Install" },
  { name: "Plant installation", default_price: 35, pricing_unit: "each", category: "Install" },
  { name: "Sod installation", default_price: 1.20, pricing_unit: "sq_ft", category: "Install" },
  { name: "Drainage improvement", default_price: 95, pricing_unit: "hour", category: "Install" },
  { name: "Landscape lighting", default_price: 125, pricing_unit: "fixture", category: "Install" },
];

const HOUSE_CLEANING: DefaultService[] = [
  { name: "Standard cleaning", default_price: 130, pricing_unit: "flat", category: "Recurring" },
  { name: "Deep cleaning", default_price: 250, pricing_unit: "flat", category: "One-time" },
  { name: "Move-in cleaning", default_price: 320, pricing_unit: "flat", category: "Move" },
  { name: "Move-out cleaning", default_price: 320, pricing_unit: "flat", category: "Move" },
  { name: "Recurring weekly cleaning", default_price: 110, pricing_unit: "visit", category: "Recurring" },
  { name: "Recurring biweekly cleaning", default_price: 130, pricing_unit: "visit", category: "Recurring" },
  { name: "Airbnb turnover", default_price: 95, pricing_unit: "visit", category: "Short-term rental" },
  { name: "Interior windows", default_price: 65, pricing_unit: "flat", category: "Add-on" },
];

const WINDOW_CLEANING: DefaultService[] = [
  { name: "Exterior window cleaning", default_price: 8, pricing_unit: "window", category: "Cleaning" },
  { name: "Interior window cleaning", default_price: 6, pricing_unit: "window", category: "Cleaning" },
  { name: "Screen cleaning", default_price: 4, pricing_unit: "window", category: "Add-on" },
  { name: "Track cleaning", default_price: 3, pricing_unit: "window", category: "Add-on" },
  { name: "Hard water stain removal", default_price: 25, pricing_unit: "window", category: "Specialty" },
  { name: "Solar panel cleaning", default_price: 12, pricing_unit: "panel", category: "Specialty" },
];

const GUTTER_CLEANING: DefaultService[] = [
  { name: "Gutter cleaning", default_price: 1.50, pricing_unit: "linear_ft", category: "Cleaning" },
  { name: "Downspout clearing", default_price: 25, pricing_unit: "each", category: "Cleaning" },
  { name: "Gutter brightening", default_price: 1.75, pricing_unit: "linear_ft", category: "Specialty" },
  { name: "Gutter guard cleaning", default_price: 2.25, pricing_unit: "linear_ft", category: "Cleaning" },
  { name: "Gutter guard installation", default_price: 9, pricing_unit: "linear_ft", category: "Install" },
];

const PAINTING: DefaultService[] = [
  { name: "Interior room painting", default_price: 425, pricing_unit: "room", category: "Interior" },
  { name: "Exterior painting", default_price: 3.50, pricing_unit: "sq_ft", category: "Exterior" },
  { name: "Trim painting", default_price: 3.25, pricing_unit: "linear_ft", category: "Detail" },
  { name: "Door painting", default_price: 95, pricing_unit: "each", category: "Detail" },
  { name: "Cabinet painting", default_price: 175, pricing_unit: "each", category: "Detail" },
  { name: "Fence staining", default_price: 2.50, pricing_unit: "linear_ft", category: "Stain" },
  { name: "Deck staining", default_price: 1.75, pricing_unit: "sq_ft", category: "Stain" },
  { name: "Drywall patch and paint", default_price: 95, pricing_unit: "flat", category: "Repair" },
];

const HANDYMAN: DefaultService[] = [
  { name: "General repair (hourly)", default_price: 85, pricing_unit: "hour", category: "Labor" },
  { name: "Door repair", default_price: 125, pricing_unit: "flat", category: "Repair" },
  { name: "Drywall repair", default_price: 95, pricing_unit: "flat", category: "Repair" },
  { name: "Furniture assembly", default_price: 95, pricing_unit: "hour", category: "Labor" },
  { name: "TV mounting", default_price: 145, pricing_unit: "flat", category: "Install" },
  { name: "Fixture replacement", default_price: 95, pricing_unit: "each", category: "Install" },
  { name: "Caulking", default_price: 75, pricing_unit: "flat", category: "Detail" },
  { name: "Picture/mirror hanging", default_price: 35, pricing_unit: "each", category: "Detail" },
];

const HVAC: DefaultService[] = [
  { name: "Diagnostic visit", default_price: 99, pricing_unit: "flat", category: "Service call" },
  { name: "AC repair", default_price: 250, pricing_unit: "flat", category: "Repair" },
  { name: "Heating repair", default_price: 250, pricing_unit: "flat", category: "Repair" },
  { name: "Preventive maintenance", default_price: 159, pricing_unit: "visit", category: "Maintenance" },
  { name: "Filter replacement", default_price: 35, pricing_unit: "each", category: "Maintenance" },
  { name: "Thermostat installation", default_price: 195, pricing_unit: "flat", category: "Install" },
  { name: "Capacitor replacement", default_price: 225, pricing_unit: "flat", category: "Repair" },
  { name: "Coil cleaning", default_price: 295, pricing_unit: "flat", category: "Maintenance" },
];

const PLUMBING: DefaultService[] = [
  { name: "Service call", default_price: 89, pricing_unit: "flat", category: "Service call" },
  { name: "Leak repair", default_price: 195, pricing_unit: "flat", category: "Repair" },
  { name: "Drain cleaning", default_price: 175, pricing_unit: "flat", category: "Repair" },
  { name: "Faucet replacement", default_price: 245, pricing_unit: "flat", category: "Install" },
  { name: "Toilet replacement", default_price: 395, pricing_unit: "flat", category: "Install" },
  { name: "Water heater repair", default_price: 350, pricing_unit: "flat", category: "Repair" },
  { name: "Garbage disposal replacement", default_price: 275, pricing_unit: "flat", category: "Install" },
  { name: "Hose bib repair", default_price: 165, pricing_unit: "flat", category: "Repair" },
];

const ELECTRICAL: DefaultService[] = [
  { name: "Service call", default_price: 89, pricing_unit: "flat", category: "Service call" },
  { name: "Outlet replacement", default_price: 95, pricing_unit: "each", category: "Install" },
  { name: "Switch replacement", default_price: 95, pricing_unit: "each", category: "Install" },
  { name: "Light fixture install", default_price: 145, pricing_unit: "each", category: "Install" },
  { name: "Ceiling fan install", default_price: 195, pricing_unit: "each", category: "Install" },
  { name: "Breaker replacement", default_price: 195, pricing_unit: "each", category: "Repair" },
  { name: "GFCI install", default_price: 145, pricing_unit: "each", category: "Install" },
  { name: "Smart switch install", default_price: 175, pricing_unit: "each", category: "Install" },
];

const POOL_SERVICE: DefaultService[] = [
  { name: "Weekly pool service", default_price: 145, pricing_unit: "month", category: "Recurring" },
  { name: "One-time cleaning", default_price: 175, pricing_unit: "visit", category: "One-time" },
  { name: "Green pool cleanup", default_price: 425, pricing_unit: "flat", category: "Restoration" },
  { name: "Filter cleaning", default_price: 125, pricing_unit: "flat", category: "Maintenance" },
  { name: "Chemical balancing", default_price: 65, pricing_unit: "visit", category: "Chemicals" },
  { name: "Salt cell cleaning", default_price: 175, pricing_unit: "flat", category: "Maintenance" },
  { name: "Pool opening", default_price: 295, pricing_unit: "flat", category: "Seasonal" },
  { name: "Pool closing", default_price: 295, pricing_unit: "flat", category: "Seasonal" },
];

const PEST_CONTROL: DefaultService[] = [
  { name: "General pest treatment", default_price: 145, pricing_unit: "visit", category: "One-time" },
  { name: "Quarterly pest plan", default_price: 110, pricing_unit: "visit", category: "Recurring" },
  { name: "Ant treatment", default_price: 125, pricing_unit: "flat", category: "Specialty" },
  { name: "Roach treatment", default_price: 175, pricing_unit: "flat", category: "Specialty" },
  { name: "Wasp removal", default_price: 95, pricing_unit: "flat", category: "Specialty" },
  { name: "Rodent inspection", default_price: 125, pricing_unit: "flat", category: "Specialty" },
  { name: "Mosquito treatment", default_price: 95, pricing_unit: "visit", category: "Recurring" },
  { name: "Termite inspection", default_price: 175, pricing_unit: "flat", category: "Specialty" },
];

const JUNK_REMOVAL: DefaultService[] = [
  { name: "Single item removal", default_price: 75, pricing_unit: "each", category: "Pickup" },
  { name: "Furniture removal", default_price: 145, pricing_unit: "each", category: "Pickup" },
  { name: "Appliance removal", default_price: 95, pricing_unit: "each", category: "Pickup" },
  { name: "Garage cleanout", default_price: 395, pricing_unit: "flat", category: "Cleanout" },
  { name: "Yard debris removal", default_price: 195, pricing_unit: "load", category: "Pickup" },
  { name: "Construction debris removal", default_price: 295, pricing_unit: "load", category: "Pickup" },
  { name: "Full truckload", default_price: 595, pricing_unit: "load", category: "Pickup" },
  { name: "Quarter truckload", default_price: 195, pricing_unit: "load", category: "Pickup" },
];

const CARPET_CLEANING: DefaultService[] = [
  { name: "Carpet cleaning", default_price: 45, pricing_unit: "room", category: "Cleaning" },
  { name: "Upholstery cleaning", default_price: 125, pricing_unit: "each", category: "Cleaning" },
  { name: "Rug cleaning", default_price: 95, pricing_unit: "each", category: "Cleaning" },
  { name: "Stain treatment", default_price: 35, pricing_unit: "flat", category: "Add-on" },
  { name: "Pet odor treatment", default_price: 75, pricing_unit: "room", category: "Add-on" },
  { name: "Tile and grout cleaning", default_price: 0.95, pricing_unit: "sq_ft", category: "Cleaning" },
];

const MOBILE_DETAILING: DefaultService[] = [
  { name: "Exterior wash", default_price: 65, pricing_unit: "each", category: "Wash" },
  { name: "Interior detail", default_price: 145, pricing_unit: "each", category: "Detail" },
  { name: "Full detail", default_price: 245, pricing_unit: "each", category: "Detail" },
  { name: "Wax/sealant", default_price: 95, pricing_unit: "each", category: "Add-on" },
  { name: "Ceramic spray", default_price: 195, pricing_unit: "each", category: "Add-on" },
  { name: "Engine bay cleaning", default_price: 75, pricing_unit: "each", category: "Add-on" },
  { name: "Headlight restoration", default_price: 95, pricing_unit: "each", category: "Specialty" },
  { name: "Pet hair removal", default_price: 65, pricing_unit: "each", category: "Add-on" },
];

const ROOFING: DefaultService[] = [
  { name: "Roof inspection", default_price: 195, pricing_unit: "flat", category: "Inspection" },
  { name: "Minor roof repair", default_price: 345, pricing_unit: "flat", category: "Repair" },
  { name: "Leak inspection", default_price: 195, pricing_unit: "flat", category: "Inspection" },
  { name: "Shingle replacement", default_price: 195, pricing_unit: "square", category: "Repair" },
  { name: "Storm damage documentation", default_price: 145, pricing_unit: "flat", category: "Inspection" },
  { name: "Emergency tarp", default_price: 395, pricing_unit: "flat", category: "Emergency" },
];

const APPLIANCE_REPAIR: DefaultService[] = [
  { name: "Diagnostic visit", default_price: 95, pricing_unit: "flat", category: "Service call" },
  { name: "Washer repair", default_price: 245, pricing_unit: "flat", category: "Repair" },
  { name: "Dryer repair", default_price: 225, pricing_unit: "flat", category: "Repair" },
  { name: "Refrigerator repair", default_price: 295, pricing_unit: "flat", category: "Repair" },
  { name: "Dishwasher repair", default_price: 245, pricing_unit: "flat", category: "Repair" },
  { name: "Oven/stove repair", default_price: 275, pricing_unit: "flat", category: "Repair" },
  { name: "Garbage disposal replacement", default_price: 275, pricing_unit: "flat", category: "Install" },
];

const DRYER_VENT: DefaultService[] = [
  { name: "Dryer vent cleaning", default_price: 145, pricing_unit: "flat", category: "Cleaning" },
  { name: "Vent inspection", default_price: 75, pricing_unit: "flat", category: "Inspection" },
  { name: "Bird nest removal", default_price: 125, pricing_unit: "flat", category: "Specialty" },
  { name: "Booster fan cleaning", default_price: 195, pricing_unit: "flat", category: "Specialty" },
  { name: "Dryer duct repair", default_price: 245, pricing_unit: "flat", category: "Repair" },
];

const HOLIDAY_LIGHTS: DefaultService[] = [
  { name: "Light installation", default_price: 9.50, pricing_unit: "linear_ft", category: "Install" },
  { name: "Light removal", default_price: 4.50, pricing_unit: "linear_ft", category: "Removal" },
  { name: "Light storage", default_price: 95, pricing_unit: "flat", category: "Add-on" },
  { name: "Tree wrapping", default_price: 95, pricing_unit: "each", category: "Install" },
  { name: "Wreath/garland install", default_price: 65, pricing_unit: "each", category: "Install" },
  { name: "Service call for outage", default_price: 95, pricing_unit: "flat", category: "Service" },
];

const GENERAL_HOME: DefaultService[] = [
  { name: "Service call", default_price: 89, pricing_unit: "flat", category: "Service call" },
  { name: "Hourly labor", default_price: 75, pricing_unit: "hour", category: "Labor" },
  { name: "General maintenance visit", default_price: 195, pricing_unit: "visit", category: "Maintenance" },
  { name: "Estimate / consultation", default_price: 0, pricing_unit: "flat", category: "Estimate" },
];

export const DEFAULT_SERVICES_BY_TRADE: Record<string, DefaultService[]> = {
  pressure_washing: PRESSURE_WASHING,
  lawn_care: LAWN_CARE,
  landscaping: LANDSCAPING,
  house_cleaning: HOUSE_CLEANING,
  window_cleaning: WINDOW_CLEANING,
  gutter_cleaning: GUTTER_CLEANING,
  painting: PAINTING,
  handyman: HANDYMAN,
  hvac: HVAC,
  plumbing: PLUMBING,
  electrical: ELECTRICAL,
  pool_service: POOL_SERVICE,
  pest_control: PEST_CONTROL,
  junk_removal: JUNK_REMOVAL,
  carpet_cleaning: CARPET_CLEANING,
  mobile_detailing: MOBILE_DETAILING,
  roofing: ROOFING,
  appliance_repair: APPLIANCE_REPAIR,
  dryer_vent: DRYER_VENT,
  holiday_lights: HOLIDAY_LIGHTS,
  general_home: GENERAL_HOME,
};

export function getDefaultsForTrade(business_type_id: string): DefaultService[] {
  return DEFAULT_SERVICES_BY_TRADE[business_type_id] ?? GENERAL_HOME;
}

// Recognised pricing units (used by the editor + validation later).
export const PRICING_UNITS: { value: string; label: string }[] = [
  { value: "flat", label: "Flat rate" },
  { value: "hour", label: "Per hour" },
  { value: "sq_ft", label: "Per sq ft" },
  { value: "linear_ft", label: "Per linear ft" },
  { value: "room", label: "Per room" },
  { value: "each", label: "Per item" },
  { value: "visit", label: "Per visit" },
  { value: "month", label: "Per month" },
  { value: "acre", label: "Per acre" },
  { value: "fixture", label: "Per fixture" },
  { value: "window", label: "Per window" },
  { value: "panel", label: "Per panel" },
  { value: "load", label: "Per load" },
  { value: "cubic_yard", label: "Per cubic yard" },
  { value: "square", label: "Per square (roofing)" },
];

export function pricingUnitLabel(unit: string | null | undefined): string {
  if (!unit) return "Flat rate";
  return PRICING_UNITS.find((u) => u.value === unit)?.label ?? unit;
}
