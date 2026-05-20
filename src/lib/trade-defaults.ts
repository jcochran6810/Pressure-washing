// Per-trade default service catalog + custom fields used to seed a fresh org
// when the operator picks a business type. Keeping these in code (not the DB)
// means we can iterate on copy and pricing without a migration each time.

export type CustomFieldDefault = {
  applies_to: "customer" | "lead" | "estimate" | "job" | "invoice" | "property";
  field_key: string;
  field_label: string;
  field_type:
    | "text" | "long_text" | "number" | "currency" | "dropdown"
    | "checkbox" | "date" | "phone" | "email" | "url";
  options?: string[];
  required?: boolean;
  customer_visible?: boolean;
};

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
  { name: "Concrete sealing", default_price: 0.85, pricing_unit: "sq_ft", category: "Finish" },
  { name: "Composite deck restoration", default_price: 0.85, pricing_unit: "sq_ft", category: "Specialty" },
  { name: "Oxidation removal (vinyl siding)", default_price: 0.45, pricing_unit: "sq_ft", category: "Specialty" },
  { name: "Brick / masonry cleaning", default_price: 0.40, pricing_unit: "sq_ft", category: "Specialty" },
  { name: "Oil stain removal", default_price: 95, pricing_unit: "flat", category: "Specialty" },
  { name: "Graffiti removal", default_price: 195, pricing_unit: "flat", category: "Specialty" },
  { name: "Rust stain removal", default_price: 125, pricing_unit: "flat", category: "Specialty" },
  { name: "Pool deck cleaning", default_price: 0.35, pricing_unit: "sq_ft", category: "Exterior cleaning" },
  { name: "Retaining wall cleaning", default_price: 0.40, pricing_unit: "sq_ft", category: "Exterior cleaning" },
  { name: "Awning / canvas cleaning", default_price: 4, pricing_unit: "linear_ft", category: "Specialty" },
  { name: "Dumpster pad cleaning (commercial)", default_price: 145, pricing_unit: "flat", category: "Commercial" },
  { name: "Paver sand reapplication", default_price: 0.95, pricing_unit: "sq_ft", category: "Specialty" },
  { name: "Storefront / flatwork (commercial)", default_price: 0.20, pricing_unit: "sq_ft", category: "Commercial" },
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
  { name: "Core aeration", default_price: 165, pricing_unit: "flat", category: "Treatment" },
  { name: "Overseeding", default_price: 125, pricing_unit: "flat", category: "Treatment" },
  { name: "Dethatching", default_price: 195, pricing_unit: "flat", category: "Treatment" },
  { name: "Fertilization (single application)", default_price: 75, pricing_unit: "visit", category: "Treatment" },
  { name: "Fertilization program (4 visits)", default_price: 295, pricing_unit: "flat", category: "Recurring" },
  { name: "Grub treatment", default_price: 145, pricing_unit: "flat", category: "Treatment" },
  { name: "Lime application", default_price: 95, pricing_unit: "flat", category: "Treatment" },
  { name: "Lawn striping / detail mow", default_price: 65, pricing_unit: "visit", category: "Maintenance" },
  { name: "Bagging clippings", default_price: 25, pricing_unit: "visit", category: "Add-on" },
  { name: "Spring cleanup", default_price: 245, pricing_unit: "flat", category: "Seasonal" },
  { name: "Fall cleanup", default_price: 295, pricing_unit: "flat", category: "Seasonal" },
];

const LANDSCAPING: DefaultService[] = [
  { name: "Landscape design consultation", default_price: 150, pricing_unit: "hour", category: "Design" },
  { name: "Flower bed installation", default_price: 18, pricing_unit: "sq_ft", category: "Install" },
  { name: "Mulch installation", default_price: 80, pricing_unit: "cubic_yard", category: "Install" },
  { name: "Plant installation", default_price: 35, pricing_unit: "each", category: "Install" },
  { name: "Sod installation", default_price: 1.20, pricing_unit: "sq_ft", category: "Install" },
  { name: "Drainage improvement", default_price: 95, pricing_unit: "hour", category: "Install" },
  { name: "Landscape lighting", default_price: 125, pricing_unit: "fixture", category: "Install" },
  { name: "Paver patio install", default_price: 22, pricing_unit: "sq_ft", category: "Hardscape" },
  { name: "Retaining wall install", default_price: 45, pricing_unit: "sq_ft", category: "Hardscape" },
  { name: "Fire pit install", default_price: 1295, pricing_unit: "each", category: "Hardscape" },
  { name: "Water feature install", default_price: 1995, pricing_unit: "each", category: "Hardscape" },
  { name: "Tree planting", default_price: 145, pricing_unit: "each", category: "Install" },
  { name: "Shrub planting", default_price: 45, pricing_unit: "each", category: "Install" },
  { name: "Decorative rock / gravel install", default_price: 95, pricing_unit: "cubic_yard", category: "Install" },
  { name: "Steel / aluminum edging install", default_price: 6.50, pricing_unit: "linear_ft", category: "Install" },
  { name: "Garden bed redo / refresh", default_price: 15, pricing_unit: "sq_ft", category: "Refresh" },
  { name: "Erosion control / silt fence", default_price: 5.50, pricing_unit: "linear_ft", category: "Install" },
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
  { name: "Oven deep clean", default_price: 85, pricing_unit: "flat", category: "Add-on" },
  { name: "Refrigerator inside clean", default_price: 65, pricing_unit: "flat", category: "Add-on" },
  { name: "Baseboard detail", default_price: 75, pricing_unit: "flat", category: "Add-on" },
  { name: "Ceiling fan detail", default_price: 35, pricing_unit: "each", category: "Add-on" },
  { name: "Blind cleaning", default_price: 15, pricing_unit: "each", category: "Add-on" },
  { name: "Cabinet interior cleaning", default_price: 95, pricing_unit: "flat", category: "Add-on" },
  { name: "Post-construction clean", default_price: 425, pricing_unit: "flat", category: "Specialty" },
  { name: "Laundry add-on", default_price: 45, pricing_unit: "visit", category: "Add-on" },
  { name: "Garage cleaning", default_price: 145, pricing_unit: "flat", category: "Specialty" },
  { name: "Hoarder / heavy soil cleanup", default_price: 145, pricing_unit: "hour", category: "Specialty" },
];

const WINDOW_CLEANING: DefaultService[] = [
  { name: "Exterior window cleaning", default_price: 8, pricing_unit: "window", category: "Cleaning" },
  { name: "Interior window cleaning", default_price: 6, pricing_unit: "window", category: "Cleaning" },
  { name: "Screen cleaning", default_price: 4, pricing_unit: "window", category: "Add-on" },
  { name: "Track cleaning", default_price: 3, pricing_unit: "window", category: "Add-on" },
  { name: "Hard water stain removal", default_price: 25, pricing_unit: "window", category: "Specialty" },
  { name: "Solar panel cleaning", default_price: 12, pricing_unit: "panel", category: "Specialty" },
  { name: "High-rise / per-story upcharge", default_price: 4, pricing_unit: "window", category: "Specialty" },
  { name: "Chandelier cleaning", default_price: 145, pricing_unit: "each", category: "Specialty" },
  { name: "Glass shower door restoration", default_price: 95, pricing_unit: "each", category: "Specialty" },
  { name: "Storefront cleaning (recurring)", default_price: 45, pricing_unit: "visit", category: "Commercial" },
  { name: "Skylight cleaning", default_price: 35, pricing_unit: "each", category: "Specialty" },
  { name: "Post-construction window clean", default_price: 18, pricing_unit: "window", category: "Specialty" },
  { name: "Mirror cleaning", default_price: 12, pricing_unit: "each", category: "Add-on" },
  { name: "Gutter face / fascia wipe", default_price: 1.25, pricing_unit: "linear_ft", category: "Add-on" },
];

const GUTTER_CLEANING: DefaultService[] = [
  { name: "Gutter cleaning", default_price: 1.50, pricing_unit: "linear_ft", category: "Cleaning" },
  { name: "Downspout clearing", default_price: 25, pricing_unit: "each", category: "Cleaning" },
  { name: "Gutter brightening", default_price: 1.75, pricing_unit: "linear_ft", category: "Specialty" },
  { name: "Gutter guard cleaning", default_price: 2.25, pricing_unit: "linear_ft", category: "Cleaning" },
  { name: "Gutter guard installation", default_price: 9, pricing_unit: "linear_ft", category: "Install" },
  { name: "Gutter realignment / re-pitch", default_price: 8, pricing_unit: "linear_ft", category: "Repair" },
  { name: "Gutter repair (per section)", default_price: 95, pricing_unit: "each", category: "Repair" },
  { name: "Downspout extension install", default_price: 65, pricing_unit: "each", category: "Install" },
  { name: "Splash block install", default_price: 35, pricing_unit: "each", category: "Install" },
  { name: "Hidden hanger install", default_price: 6, pricing_unit: "each", category: "Repair" },
  { name: "Micro-mesh guard install", default_price: 11, pricing_unit: "linear_ft", category: "Install" },
  { name: "Seamless gutter install", default_price: 13, pricing_unit: "linear_ft", category: "Install" },
  { name: "Two-story upcharge", default_price: 0.50, pricing_unit: "linear_ft", category: "Specialty" },
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
  { name: "Ceiling painting", default_price: 1.95, pricing_unit: "sq_ft", category: "Interior" },
  { name: "Accent wall", default_price: 195, pricing_unit: "flat", category: "Interior" },
  { name: "Garage floor paint", default_price: 4.50, pricing_unit: "sq_ft", category: "Specialty" },
  { name: "Popcorn ceiling removal", default_price: 2.25, pricing_unit: "sq_ft", category: "Specialty" },
  { name: "Wallpaper removal", default_price: 2.50, pricing_unit: "sq_ft", category: "Prep" },
  { name: "Color consultation", default_price: 95, pricing_unit: "flat", category: "Consult" },
  { name: "Pressure-wash prep (exterior)", default_price: 0.20, pricing_unit: "sq_ft", category: "Prep" },
  { name: "Deck refinish (sand + stain)", default_price: 3.50, pricing_unit: "sq_ft", category: "Stain" },
  { name: "Epoxy + clearcoat detail", default_price: 245, pricing_unit: "flat", category: "Detail" },
  { name: "Touch-up service visit", default_price: 145, pricing_unit: "flat", category: "Service" },
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
  { name: "Door hardware swap", default_price: 65, pricing_unit: "each", category: "Install" },
  { name: "Weather stripping install", default_price: 75, pricing_unit: "flat", category: "Install" },
  { name: "Smoke detector replacement", default_price: 45, pricing_unit: "each", category: "Install" },
  { name: "Mailbox install", default_price: 125, pricing_unit: "each", category: "Install" },
  { name: "Blinds / shade install", default_price: 55, pricing_unit: "each", category: "Install" },
  { name: "Toilet replacement", default_price: 295, pricing_unit: "each", category: "Install" },
  { name: "Light bulb refresh visit", default_price: 65, pricing_unit: "flat", category: "Service" },
  { name: "Drawer / cabinet repair", default_price: 65, pricing_unit: "each", category: "Repair" },
  { name: "Childproofing / aging-in-place mods", default_price: 95, pricing_unit: "hour", category: "Specialty" },
  { name: "Pre-listing fix list", default_price: 95, pricing_unit: "hour", category: "Specialty" },
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
  { name: "Refrigerant recharge", default_price: 295, pricing_unit: "flat", category: "Repair" },
  { name: "Blower motor replacement", default_price: 595, pricing_unit: "flat", category: "Repair" },
  { name: "Condensate line clearing", default_price: 165, pricing_unit: "flat", category: "Maintenance" },
  { name: "Condenser cleaning", default_price: 195, pricing_unit: "flat", category: "Maintenance" },
  { name: "Mini-split install (per head)", default_price: 2495, pricing_unit: "each", category: "Install" },
  { name: "Heat pump install", default_price: 6995, pricing_unit: "flat", category: "Install" },
  { name: "Furnace install", default_price: 4495, pricing_unit: "flat", category: "Install" },
  { name: "AC unit install (split)", default_price: 5495, pricing_unit: "flat", category: "Install" },
  { name: "UV sanitizer install", default_price: 595, pricing_unit: "each", category: "Install" },
  { name: "Ductwork cleaning", default_price: 595, pricing_unit: "flat", category: "Maintenance" },
  { name: "Annual service plan", default_price: 199, pricing_unit: "flat", category: "Recurring" },
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
  { name: "Sewer camera inspection", default_price: 295, pricing_unit: "flat", category: "Inspection" },
  { name: "Hydro-jetting", default_price: 495, pricing_unit: "flat", category: "Repair" },
  { name: "Water heater replacement (tank)", default_price: 1495, pricing_unit: "each", category: "Install" },
  { name: "Tankless water heater install", default_price: 2995, pricing_unit: "each", category: "Install" },
  { name: "Water softener install", default_price: 1495, pricing_unit: "each", category: "Install" },
  { name: "Sump pump install", default_price: 595, pricing_unit: "each", category: "Install" },
  { name: "Pressure regulator replacement", default_price: 425, pricing_unit: "flat", category: "Repair" },
  { name: "Gas line install (per ft)", default_price: 28, pricing_unit: "linear_ft", category: "Install" },
  { name: "Slab leak detection", default_price: 395, pricing_unit: "flat", category: "Inspection" },
  { name: "Re-piping (per fixture estimate)", default_price: 595, pricing_unit: "each", category: "Install" },
  { name: "Backflow preventer test", default_price: 95, pricing_unit: "flat", category: "Inspection" },
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
  { name: "Panel upgrade (200A)", default_price: 2495, pricing_unit: "flat", category: "Install" },
  { name: "Sub-panel install", default_price: 1495, pricing_unit: "flat", category: "Install" },
  { name: "EV charger install (Level 2)", default_price: 895, pricing_unit: "each", category: "Install" },
  { name: "Generator transfer switch install", default_price: 1495, pricing_unit: "flat", category: "Install" },
  { name: "Whole-home surge protector", default_price: 495, pricing_unit: "each", category: "Install" },
  { name: "Recessed lighting install", default_price: 145, pricing_unit: "each", category: "Install" },
  { name: "Under-cabinet lighting", default_price: 295, pricing_unit: "flat", category: "Install" },
  { name: "Doorbell / camera install", default_price: 175, pricing_unit: "each", category: "Install" },
  { name: "Hardwired smoke + CO detector", default_price: 145, pricing_unit: "each", category: "Install" },
  { name: "Attic fan install", default_price: 495, pricing_unit: "each", category: "Install" },
  { name: "Outdoor outlet install", default_price: 195, pricing_unit: "each", category: "Install" },
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
  { name: "Leak detection", default_price: 295, pricing_unit: "flat", category: "Diagnostic" },
  { name: "Tile cleaning (waterline)", default_price: 250, pricing_unit: "flat", category: "Maintenance" },
  { name: "Pool motor replacement", default_price: 595, pricing_unit: "flat", category: "Repair" },
  { name: "Heater repair", default_price: 425, pricing_unit: "flat", category: "Repair" },
  { name: "Saltwater conversion", default_price: 1495, pricing_unit: "flat", category: "Install" },
  { name: "Automation install (smart controller)", default_price: 1295, pricing_unit: "flat", category: "Install" },
  { name: "Cover install / replacement", default_price: 595, pricing_unit: "each", category: "Install" },
  { name: "Acid wash (drain + scrub)", default_price: 695, pricing_unit: "flat", category: "Restoration" },
  { name: "Pool deck resurfacing referral", default_price: 0, pricing_unit: "flat", category: "Consult" },
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
  { name: "Termite treatment", default_price: 1495, pricing_unit: "flat", category: "Specialty" },
  { name: "Bed bug treatment", default_price: 595, pricing_unit: "flat", category: "Specialty" },
  { name: "Flea treatment (interior)", default_price: 245, pricing_unit: "flat", category: "Specialty" },
  { name: "Tick treatment (yard)", default_price: 145, pricing_unit: "visit", category: "Recurring" },
  { name: "Scorpion treatment", default_price: 195, pricing_unit: "flat", category: "Specialty" },
  { name: "Spider treatment", default_price: 145, pricing_unit: "flat", category: "Specialty" },
  { name: "Attic exclusion", default_price: 395, pricing_unit: "flat", category: "Specialty" },
  { name: "Crawl space treatment", default_price: 395, pricing_unit: "flat", category: "Specialty" },
  { name: "Wildlife trapping (per animal)", default_price: 195, pricing_unit: "each", category: "Specialty" },
  { name: "Annual termite renewal", default_price: 195, pricing_unit: "flat", category: "Recurring" },
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
  { name: "Hot tub removal", default_price: 495, pricing_unit: "each", category: "Specialty" },
  { name: "Mattress disposal", default_price: 95, pricing_unit: "each", category: "Pickup" },
  { name: "Piano removal", default_price: 395, pricing_unit: "each", category: "Specialty" },
  { name: "Swing set / playset removal", default_price: 395, pricing_unit: "each", category: "Specialty" },
  { name: "Tire disposal", default_price: 18, pricing_unit: "each", category: "Pickup" },
  { name: "Electronics recycling", default_price: 35, pricing_unit: "each", category: "Pickup" },
  { name: "Donation drop-off run", default_price: 145, pricing_unit: "flat", category: "Add-on" },
  { name: "Hoarder cleanout", default_price: 145, pricing_unit: "hour", category: "Specialty" },
  { name: "Estate cleanout", default_price: 145, pricing_unit: "hour", category: "Specialty" },
  { name: "Same-day rush surcharge", default_price: 95, pricing_unit: "flat", category: "Add-on" },
];

const CARPET_CLEANING: DefaultService[] = [
  { name: "Carpet cleaning", default_price: 45, pricing_unit: "room", category: "Cleaning" },
  { name: "Upholstery cleaning", default_price: 125, pricing_unit: "each", category: "Cleaning" },
  { name: "Rug cleaning", default_price: 95, pricing_unit: "each", category: "Cleaning" },
  { name: "Stain treatment", default_price: 35, pricing_unit: "flat", category: "Add-on" },
  { name: "Pet odor treatment", default_price: 75, pricing_unit: "room", category: "Add-on" },
  { name: "Tile and grout cleaning", default_price: 0.95, pricing_unit: "sq_ft", category: "Cleaning" },
  { name: "Tile and grout sealing", default_price: 0.75, pricing_unit: "sq_ft", category: "Finish" },
  { name: "Mattress cleaning", default_price: 95, pricing_unit: "each", category: "Cleaning" },
  { name: "Area rug pickup + delivery", default_price: 65, pricing_unit: "flat", category: "Add-on" },
  { name: "Scotchgard protection", default_price: 0.20, pricing_unit: "sq_ft", category: "Add-on" },
  { name: "Anti-allergen treatment", default_price: 95, pricing_unit: "flat", category: "Add-on" },
  { name: "Water extraction (per room)", default_price: 145, pricing_unit: "room", category: "Restoration" },
  { name: "Auto / RV interior detail", default_price: 165, pricing_unit: "each", category: "Specialty" },
  { name: "Rotary scrub / heavy traffic restoration", default_price: 145, pricing_unit: "room", category: "Specialty" },
  { name: "Commercial sq-ft rate", default_price: 0.35, pricing_unit: "sq_ft", category: "Commercial" },
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
  { name: "Clay bar treatment", default_price: 85, pricing_unit: "each", category: "Add-on" },
  { name: "1-step paint correction", default_price: 295, pricing_unit: "each", category: "Specialty" },
  { name: "2-step paint correction", default_price: 595, pricing_unit: "each", category: "Specialty" },
  { name: "Ceramic coating (1 year)", default_price: 495, pricing_unit: "each", category: "Specialty" },
  { name: "Ceramic coating (multi-year)", default_price: 1295, pricing_unit: "each", category: "Specialty" },
  { name: "Leather conditioning", default_price: 75, pricing_unit: "each", category: "Add-on" },
  { name: "Boat detail (per ft)", default_price: 22, pricing_unit: "linear_ft", category: "Specialty" },
  { name: "RV / motorhome detail", default_price: 595, pricing_unit: "each", category: "Specialty" },
  { name: "Motorcycle detail", default_price: 145, pricing_unit: "each", category: "Specialty" },
  { name: "Fleet rate (per vehicle)", default_price: 65, pricing_unit: "each", category: "Commercial" },
  { name: "Mobile fee / travel", default_price: 25, pricing_unit: "flat", category: "Add-on" },
];

const ROOFING: DefaultService[] = [
  { name: "Roof inspection", default_price: 195, pricing_unit: "flat", category: "Inspection" },
  { name: "Minor roof repair", default_price: 345, pricing_unit: "flat", category: "Repair" },
  { name: "Leak inspection", default_price: 195, pricing_unit: "flat", category: "Inspection" },
  { name: "Shingle replacement", default_price: 195, pricing_unit: "square", category: "Repair" },
  { name: "Storm damage documentation", default_price: 145, pricing_unit: "flat", category: "Inspection" },
  { name: "Emergency tarp", default_price: 395, pricing_unit: "flat", category: "Emergency" },
  { name: "Full roof replacement (asphalt)", default_price: 425, pricing_unit: "square", category: "Install" },
  { name: "Metal roof install", default_price: 950, pricing_unit: "square", category: "Install" },
  { name: "TPO / flat roof install (commercial)", default_price: 7.50, pricing_unit: "sq_ft", category: "Install" },
  { name: "Flashing repair", default_price: 295, pricing_unit: "flat", category: "Repair" },
  { name: "Ridge vent install", default_price: 12, pricing_unit: "linear_ft", category: "Install" },
  { name: "Attic ventilation upgrade", default_price: 495, pricing_unit: "flat", category: "Install" },
  { name: "Skylight install / replacement", default_price: 1295, pricing_unit: "each", category: "Install" },
  { name: "Skylight flashing repair", default_price: 295, pricing_unit: "each", category: "Repair" },
  { name: "Ice dam removal", default_price: 295, pricing_unit: "hour", category: "Emergency" },
  { name: "Soffit / fascia repair", default_price: 18, pricing_unit: "linear_ft", category: "Repair" },
  { name: "Roof soft-wash (algae / moss)", default_price: 0.45, pricing_unit: "sq_ft", category: "Maintenance" },
  { name: "Solar panel removal / re-set for re-roof", default_price: 125, pricing_unit: "panel", category: "Specialty" },
];

const APPLIANCE_REPAIR: DefaultService[] = [
  { name: "Diagnostic visit", default_price: 95, pricing_unit: "flat", category: "Service call" },
  { name: "Washer repair", default_price: 245, pricing_unit: "flat", category: "Repair" },
  { name: "Dryer repair", default_price: 225, pricing_unit: "flat", category: "Repair" },
  { name: "Refrigerator repair", default_price: 295, pricing_unit: "flat", category: "Repair" },
  { name: "Dishwasher repair", default_price: 245, pricing_unit: "flat", category: "Repair" },
  { name: "Oven/stove repair", default_price: 275, pricing_unit: "flat", category: "Repair" },
  { name: "Garbage disposal replacement", default_price: 275, pricing_unit: "flat", category: "Install" },
  { name: "Ice maker repair", default_price: 245, pricing_unit: "flat", category: "Repair" },
  { name: "Microwave repair", default_price: 195, pricing_unit: "flat", category: "Repair" },
  { name: "Freezer repair", default_price: 295, pricing_unit: "flat", category: "Repair" },
  { name: "Range hood install", default_price: 295, pricing_unit: "flat", category: "Install" },
  { name: "Wine cooler / mini-fridge repair", default_price: 245, pricing_unit: "flat", category: "Repair" },
  { name: "Pre-purchase appliance inspection", default_price: 145, pricing_unit: "flat", category: "Inspection" },
  { name: "Warranty / parts-only swap", default_price: 145, pricing_unit: "flat", category: "Labor" },
];

const DRYER_VENT: DefaultService[] = [
  { name: "Dryer vent cleaning", default_price: 145, pricing_unit: "flat", category: "Cleaning" },
  { name: "Vent inspection", default_price: 75, pricing_unit: "flat", category: "Inspection" },
  { name: "Bird nest removal", default_price: 125, pricing_unit: "flat", category: "Specialty" },
  { name: "Booster fan cleaning", default_price: 195, pricing_unit: "flat", category: "Specialty" },
  { name: "Dryer duct repair", default_price: 245, pricing_unit: "flat", category: "Repair" },
  { name: "Lint screen housing replacement", default_price: 95, pricing_unit: "flat", category: "Repair" },
  { name: "Transition hose replacement", default_price: 65, pricing_unit: "flat", category: "Repair" },
  { name: "Roof termination cleaning", default_price: 195, pricing_unit: "flat", category: "Specialty" },
  { name: "Recessed dryer box install", default_price: 245, pricing_unit: "flat", category: "Install" },
  { name: "Multi-unit / property manager rate", default_price: 95, pricing_unit: "each", category: "Commercial" },
  { name: "Annual cleaning plan", default_price: 125, pricing_unit: "flat", category: "Recurring" },
];

const HOLIDAY_LIGHTS: DefaultService[] = [
  { name: "Light installation", default_price: 9.50, pricing_unit: "linear_ft", category: "Install" },
  { name: "Light removal", default_price: 4.50, pricing_unit: "linear_ft", category: "Removal" },
  { name: "Light storage", default_price: 95, pricing_unit: "flat", category: "Add-on" },
  { name: "Tree wrapping", default_price: 95, pricing_unit: "each", category: "Install" },
  { name: "Wreath/garland install", default_price: 65, pricing_unit: "each", category: "Install" },
  { name: "Service call for outage", default_price: 95, pricing_unit: "flat", category: "Service" },
  { name: "Roof line install (C9)", default_price: 11, pricing_unit: "linear_ft", category: "Install" },
  { name: "Bushes / hedges wrap", default_price: 45, pricing_unit: "each", category: "Install" },
  { name: "Mega tree install (16+ ft)", default_price: 495, pricing_unit: "each", category: "Install" },
  { name: "Animated / programmable display", default_price: 295, pricing_unit: "flat", category: "Add-on" },
  { name: "Mid-season service call", default_price: 95, pricing_unit: "flat", category: "Service" },
  { name: "Takedown + storage combo", default_price: 145, pricing_unit: "flat", category: "Add-on" },
  { name: "Commercial / HOA package", default_price: 1495, pricing_unit: "flat", category: "Commercial" },
];

const GENERAL_HOME: DefaultService[] = [
  { name: "Service call", default_price: 89, pricing_unit: "flat", category: "Service call" },
  { name: "Hourly labor", default_price: 75, pricing_unit: "hour", category: "Labor" },
  { name: "General maintenance visit", default_price: 195, pricing_unit: "visit", category: "Maintenance" },
  { name: "Estimate / consultation", default_price: 0, pricing_unit: "flat", category: "Estimate" },
  { name: "Walk-through inspection", default_price: 145, pricing_unit: "flat", category: "Inspection" },
  { name: "Project quoting", default_price: 95, pricing_unit: "hour", category: "Consult" },
  { name: "Pre-listing prep package", default_price: 595, pricing_unit: "flat", category: "Specialty" },
  { name: "Light renovation labor", default_price: 95, pricing_unit: "hour", category: "Labor" },
  { name: "Travel / mobile fee", default_price: 45, pricing_unit: "flat", category: "Add-on" },
];

const TREE_SERVICE: DefaultService[] = [
  { name: "Tree trimming (small)", default_price: 275, pricing_unit: "each", category: "Trimming" },
  { name: "Tree trimming (large)", default_price: 650, pricing_unit: "each", category: "Trimming" },
  { name: "Tree removal (small)", default_price: 450, pricing_unit: "each", category: "Removal" },
  { name: "Tree removal (medium)", default_price: 950, pricing_unit: "each", category: "Removal" },
  { name: "Tree removal (large)", default_price: 1850, pricing_unit: "each", category: "Removal" },
  { name: "Stump grinding", default_price: 175, pricing_unit: "each", category: "Removal" },
  { name: "Emergency / storm response", default_price: 195, pricing_unit: "hour", category: "Emergency" },
  { name: "Tree inspection / arborist consult", default_price: 175, pricing_unit: "flat", category: "Consult" },
  { name: "Brush hauling", default_price: 95, pricing_unit: "load", category: "Cleanup" },
  { name: "Cabling / bracing", default_price: 295, pricing_unit: "each", category: "Specialty" },
  { name: "Deep root fertilization", default_price: 145, pricing_unit: "each", category: "Treatment" },
  { name: "Pest / disease injection", default_price: 195, pricing_unit: "each", category: "Treatment" },
  { name: "Lot clearing (per hour)", default_price: 245, pricing_unit: "hour", category: "Specialty" },
  { name: "Crane day rate", default_price: 1995, pricing_unit: "flat", category: "Specialty" },
  { name: "Log splitting", default_price: 95, pricing_unit: "hour", category: "Cleanup" },
  { name: "Firewood delivery (per cord)", default_price: 245, pricing_unit: "each", category: "Add-on" },
  { name: "Crown raising / thinning", default_price: 395, pricing_unit: "each", category: "Trimming" },
];

const FENCING: DefaultService[] = [
  { name: "Wood fence install", default_price: 35, pricing_unit: "linear_ft", category: "Install" },
  { name: "Vinyl fence install", default_price: 45, pricing_unit: "linear_ft", category: "Install" },
  { name: "Chain link fence install", default_price: 22, pricing_unit: "linear_ft", category: "Install" },
  { name: "Aluminum / iron fence install", default_price: 65, pricing_unit: "linear_ft", category: "Install" },
  { name: "Gate install", default_price: 395, pricing_unit: "each", category: "Install" },
  { name: "Fence repair", default_price: 95, pricing_unit: "hour", category: "Repair" },
  { name: "Post replacement", default_price: 145, pricing_unit: "each", category: "Repair" },
  { name: "Fence staining / sealing", default_price: 2.50, pricing_unit: "linear_ft", category: "Finish" },
  { name: "Fence pressure wash", default_price: 1.25, pricing_unit: "linear_ft", category: "Maintenance" },
  { name: "Privacy slat install (chain link)", default_price: 6, pricing_unit: "linear_ft", category: "Install" },
  { name: "Automatic gate opener install", default_price: 1295, pricing_unit: "each", category: "Install" },
  { name: "Fence demolition + haul", default_price: 4.50, pricing_unit: "linear_ft", category: "Removal" },
  { name: "Post cap / decorative upgrade", default_price: 18, pricing_unit: "each", category: "Add-on" },
  { name: "Dig safe / call-before-you-dig coordination", default_price: 75, pricing_unit: "flat", category: "Add-on" },
  { name: "Dog ear pickets replacement", default_price: 8, pricing_unit: "each", category: "Repair" },
];

const SNOW_REMOVAL: DefaultService[] = [
  { name: "Driveway plow (residential)", default_price: 55, pricing_unit: "visit", category: "Plowing" },
  { name: "Sidewalk shoveling", default_price: 35, pricing_unit: "visit", category: "Shoveling" },
  { name: "Salting / de-icing", default_price: 45, pricing_unit: "visit", category: "Treatment" },
  { name: "Seasonal contract (residential)", default_price: 595, pricing_unit: "month", category: "Recurring" },
  { name: "Commercial lot plow", default_price: 195, pricing_unit: "visit", category: "Plowing" },
  { name: "Per-inch billing", default_price: 35, pricing_unit: "visit", category: "Plowing" },
  { name: "Roof snow removal", default_price: 295, pricing_unit: "flat", category: "Specialty" },
  { name: "Sand spreading", default_price: 55, pricing_unit: "visit", category: "Treatment" },
  { name: "Calcium chloride treatment", default_price: 65, pricing_unit: "visit", category: "Treatment" },
  { name: "Walkway snow blowing", default_price: 35, pricing_unit: "visit", category: "Shoveling" },
  { name: "Ice dam removal", default_price: 245, pricing_unit: "hour", category: "Emergency" },
  { name: "After-hours emergency call-out", default_price: 195, pricing_unit: "visit", category: "Emergency" },
  { name: "Commercial seasonal contract", default_price: 2495, pricing_unit: "month", category: "Recurring" },
  { name: "Storm event mobilization fee", default_price: 95, pricing_unit: "visit", category: "Add-on" },
];

const GARAGE_DOOR: DefaultService[] = [
  { name: "Service call / diagnostic", default_price: 89, pricing_unit: "flat", category: "Service call" },
  { name: "Spring replacement (single)", default_price: 245, pricing_unit: "flat", category: "Repair" },
  { name: "Spring replacement (pair)", default_price: 395, pricing_unit: "flat", category: "Repair" },
  { name: "Opener install", default_price: 495, pricing_unit: "each", category: "Install" },
  { name: "Cable replacement", default_price: 195, pricing_unit: "flat", category: "Repair" },
  { name: "Roller / track repair", default_price: 175, pricing_unit: "flat", category: "Repair" },
  { name: "Panel replacement", default_price: 395, pricing_unit: "each", category: "Repair" },
  { name: "New door install", default_price: 1495, pricing_unit: "each", category: "Install" },
  { name: "Tune-up / safety inspection", default_price: 125, pricing_unit: "flat", category: "Maintenance" },
  { name: "Keypad install", default_price: 145, pricing_unit: "each", category: "Install" },
  { name: "Smart Wi-Fi opener install", default_price: 595, pricing_unit: "each", category: "Install" },
  { name: "Weather seal / bottom seal replacement", default_price: 125, pricing_unit: "flat", category: "Repair" },
  { name: "Jamb / side seal install", default_price: 175, pricing_unit: "flat", category: "Install" },
  { name: "Lubrication service visit", default_price: 89, pricing_unit: "flat", category: "Maintenance" },
  { name: "Hurricane reinforcement kit", default_price: 595, pricing_unit: "each", category: "Specialty" },
  { name: "Insulated panel upgrade", default_price: 95, pricing_unit: "each", category: "Install" },
  { name: "After-hours emergency call", default_price: 195, pricing_unit: "flat", category: "Emergency" },
];

const CONCRETE: DefaultService[] = [
  { name: "Concrete driveway", default_price: 9.50, pricing_unit: "sq_ft", category: "Install" },
  { name: "Concrete patio", default_price: 11.50, pricing_unit: "sq_ft", category: "Install" },
  { name: "Concrete sidewalk", default_price: 9.00, pricing_unit: "sq_ft", category: "Install" },
  { name: "Stamped / decorative concrete", default_price: 16.00, pricing_unit: "sq_ft", category: "Install" },
  { name: "Concrete repair / patch", default_price: 295, pricing_unit: "flat", category: "Repair" },
  { name: "Concrete sealing", default_price: 1.25, pricing_unit: "sq_ft", category: "Finish" },
  { name: "Brick / paver install", default_price: 18, pricing_unit: "sq_ft", category: "Install" },
  { name: "Mortar / tuckpointing repair", default_price: 12, pricing_unit: "sq_ft", category: "Repair" },
  { name: "Demolition + haul", default_price: 4.50, pricing_unit: "sq_ft", category: "Removal" },
  { name: "Exposed aggregate finish", default_price: 13.50, pricing_unit: "sq_ft", category: "Finish" },
  { name: "Mudjacking / slab leveling", default_price: 6.50, pricing_unit: "sq_ft", category: "Repair" },
  { name: "Polyurethane foam leveling", default_price: 8.50, pricing_unit: "sq_ft", category: "Repair" },
  { name: "Expansion joint install / resealing", default_price: 4.50, pricing_unit: "linear_ft", category: "Repair" },
  { name: "Decorative saw-cut scoring", default_price: 2.50, pricing_unit: "linear_ft", category: "Finish" },
  { name: "Concrete steps / stoop pour", default_price: 195, pricing_unit: "each", category: "Install" },
  { name: "Footings (per linear foot)", default_price: 28, pricing_unit: "linear_ft", category: "Install" },
];

const IRRIGATION: DefaultService[] = [
  { name: "System install (per zone)", default_price: 695, pricing_unit: "each", category: "Install" },
  { name: "Sprinkler head replacement", default_price: 35, pricing_unit: "each", category: "Repair" },
  { name: "Valve repair", default_price: 145, pricing_unit: "each", category: "Repair" },
  { name: "Leak repair", default_price: 195, pricing_unit: "flat", category: "Repair" },
  { name: "Backflow testing", default_price: 95, pricing_unit: "flat", category: "Inspection" },
  { name: "Winterization / blowout", default_price: 95, pricing_unit: "flat", category: "Seasonal" },
  { name: "Spring start-up", default_price: 110, pricing_unit: "flat", category: "Seasonal" },
  { name: "Controller upgrade (smart)", default_price: 395, pricing_unit: "flat", category: "Install" },
  { name: "Drip line install", default_price: 3.50, pricing_unit: "linear_ft", category: "Install" },
  { name: "Rain sensor install", default_price: 145, pricing_unit: "each", category: "Install" },
  { name: "Master valve install", default_price: 295, pricing_unit: "each", category: "Install" },
  { name: "Pump install (booster)", default_price: 895, pricing_unit: "each", category: "Install" },
  { name: "Drip emitter cleaning", default_price: 75, pricing_unit: "flat", category: "Maintenance" },
  { name: "Manifold rebuild", default_price: 395, pricing_unit: "each", category: "Repair" },
  { name: "Mid-season tune-up", default_price: 145, pricing_unit: "flat", category: "Maintenance" },
  { name: "Decoder repair (commercial)", default_price: 245, pricing_unit: "each", category: "Repair" },
];

const EPOXY_FLOORING: DefaultService[] = [
  { name: "Garage epoxy (1-car)", default_price: 1495, pricing_unit: "flat", category: "Install" },
  { name: "Garage epoxy (2-car)", default_price: 2395, pricing_unit: "flat", category: "Install" },
  { name: "Garage epoxy (3-car)", default_price: 3295, pricing_unit: "flat", category: "Install" },
  { name: "Epoxy flake coating", default_price: 7.50, pricing_unit: "sq_ft", category: "Install" },
  { name: "Polyaspartic coating", default_price: 9.50, pricing_unit: "sq_ft", category: "Install" },
  { name: "Polished concrete", default_price: 6.50, pricing_unit: "sq_ft", category: "Finish" },
  { name: "Concrete prep / grinding", default_price: 2.00, pricing_unit: "sq_ft", category: "Prep" },
  { name: "Crack / joint repair", default_price: 8, pricing_unit: "linear_ft", category: "Prep" },
  { name: "Shop / warehouse floor coating", default_price: 5.50, pricing_unit: "sq_ft", category: "Install" },
  { name: "Basement floor coating", default_price: 5.50, pricing_unit: "sq_ft", category: "Install" },
  { name: "Commercial kitchen coating (USDA / FDA)", default_price: 11.50, pricing_unit: "sq_ft", category: "Specialty" },
  { name: "Anti-slip additive", default_price: 1.00, pricing_unit: "sq_ft", category: "Add-on" },
  { name: "Color flake premium upgrade", default_price: 1.50, pricing_unit: "sq_ft", category: "Add-on" },
  { name: "Top-coat refresh", default_price: 3.00, pricing_unit: "sq_ft", category: "Maintenance" },
  { name: "Line striping / parking layout", default_price: 1.25, pricing_unit: "linear_ft", category: "Specialty" },
  { name: "Custom logo inlay", default_price: 495, pricing_unit: "each", category: "Specialty" },
];

const SOLAR_INSTALL: DefaultService[] = [
  { name: "Solar consultation", default_price: 0, pricing_unit: "flat", category: "Consult" },
  { name: "Panel install (per panel)", default_price: 695, pricing_unit: "each", category: "Install" },
  { name: "Inverter install", default_price: 1995, pricing_unit: "each", category: "Install" },
  { name: "Battery backup install", default_price: 9995, pricing_unit: "each", category: "Install" },
  { name: "Roof penetration / mount", default_price: 95, pricing_unit: "each", category: "Install" },
  { name: "System inspection", default_price: 195, pricing_unit: "flat", category: "Inspection" },
  { name: "Panel cleaning", default_price: 12, pricing_unit: "panel", category: "Maintenance" },
  { name: "Monitoring system setup", default_price: 395, pricing_unit: "flat", category: "Install" },
  { name: "Repair service call", default_price: 195, pricing_unit: "flat", category: "Service call" },
  { name: "Critter guard install", default_price: 18, pricing_unit: "linear_ft", category: "Add-on" },
  { name: "Ground mount install", default_price: 1495, pricing_unit: "flat", category: "Install" },
  { name: "Micro-inverter retrofit", default_price: 145, pricing_unit: "each", category: "Install" },
  { name: "System uninstall + re-install for re-roof", default_price: 245, pricing_unit: "panel", category: "Specialty" },
  { name: "Re-activation / re-commissioning", default_price: 495, pricing_unit: "flat", category: "Service" },
  { name: "Soiling / production audit", default_price: 245, pricing_unit: "flat", category: "Inspection" },
  { name: "EV charger pairing", default_price: 895, pricing_unit: "each", category: "Install" },
];

const CHIMNEY_SWEEP: DefaultService[] = [
  { name: "Chimney sweep / cleaning", default_price: 245, pricing_unit: "flat", category: "Cleaning" },
  { name: "Level 1 inspection", default_price: 125, pricing_unit: "flat", category: "Inspection" },
  { name: "Level 2 inspection (real estate)", default_price: 295, pricing_unit: "flat", category: "Inspection" },
  { name: "Cap install", default_price: 195, pricing_unit: "each", category: "Install" },
  { name: "Crown repair", default_price: 495, pricing_unit: "flat", category: "Repair" },
  { name: "Flue liner install", default_price: 1995, pricing_unit: "flat", category: "Install" },
  { name: "Damper repair / replacement", default_price: 395, pricing_unit: "flat", category: "Repair" },
  { name: "Animal removal", default_price: 195, pricing_unit: "flat", category: "Specialty" },
  { name: "Dryer chimney sweep", default_price: 195, pricing_unit: "flat", category: "Cleaning" },
  { name: "Smoke chamber parging", default_price: 595, pricing_unit: "flat", category: "Repair" },
  { name: "Video inspection (NFPA 211)", default_price: 195, pricing_unit: "flat", category: "Inspection" },
  { name: "Waterproofing (sealer)", default_price: 295, pricing_unit: "flat", category: "Specialty" },
  { name: "Crown coat application", default_price: 245, pricing_unit: "flat", category: "Repair" },
  { name: "Top-mount damper install", default_price: 425, pricing_unit: "each", category: "Install" },
  { name: "Glass door install / replacement", default_price: 495, pricing_unit: "each", category: "Install" },
  { name: "Masonry restoration (per ft)", default_price: 95, pricing_unit: "linear_ft", category: "Repair" },
];

// Per-trade custom-field templates. These live on the job (most common) by
// default; estimates inherit them implicitly via the line items. Trades that
// have nothing trade-specific to capture (e.g. general_home) get an empty list.
export const DEFAULT_CUSTOM_FIELDS_BY_TRADE: Record<string, CustomFieldDefault[]> = {
  pressure_washing: [
    { applies_to: "job", field_key: "square_footage", field_label: "Square footage", field_type: "number" },
    { applies_to: "job", field_key: "surface_type", field_label: "Surface type", field_type: "dropdown", options: ["Concrete","Brick","Stucco","Vinyl","Wood","Composite","Pavers"] },
    { applies_to: "job", field_key: "soft_wash", field_label: "Soft wash required", field_type: "checkbox" },
    { applies_to: "job", field_key: "water_source", field_label: "Water source on-site", field_type: "checkbox" },
    { applies_to: "job", field_key: "stain_notes", field_label: "Stain / discoloration notes", field_type: "long_text" },
  ],
  lawn_care: [
    { applies_to: "job", field_key: "yard_size_sqft", field_label: "Yard size (sq ft)", field_type: "number" },
    { applies_to: "job", field_key: "gate_code", field_label: "Gate code", field_type: "text", customer_visible: false },
    { applies_to: "job", field_key: "pets_in_yard", field_label: "Pets in yard", field_type: "checkbox" },
    { applies_to: "job", field_key: "bag_clippings", field_label: "Bag clippings", field_type: "checkbox" },
    { applies_to: "job", field_key: "preferred_height", field_label: "Preferred mow height", field_type: "text" },
  ],
  house_cleaning: [
    { applies_to: "job", field_key: "square_footage", field_label: "Square footage", field_type: "number" },
    { applies_to: "job", field_key: "bedrooms", field_label: "Bedrooms", field_type: "number" },
    { applies_to: "job", field_key: "bathrooms", field_label: "Bathrooms", field_type: "number" },
    { applies_to: "job", field_key: "cleaning_type", field_label: "Cleaning type", field_type: "dropdown", options: ["Standard","Deep","Move-in","Move-out","Recurring"] },
    { applies_to: "job", field_key: "pets", field_label: "Pets", field_type: "checkbox" },
    { applies_to: "job", field_key: "supplies_provided", field_label: "Supplies provided by us", field_type: "checkbox" },
    { applies_to: "job", field_key: "access_instructions", field_label: "Access instructions", field_type: "long_text" },
  ],
  painting: [
    { applies_to: "job", field_key: "interior_exterior", field_label: "Interior or exterior", field_type: "dropdown", options: ["Interior","Exterior","Both"] },
    { applies_to: "job", field_key: "rooms_count", field_label: "Number of rooms / surfaces", field_type: "number" },
    { applies_to: "job", field_key: "wall_condition", field_label: "Wall condition", field_type: "dropdown", options: ["Good","Minor patching","Major repair"] },
    { applies_to: "job", field_key: "paint_supplied", field_label: "Customer supplying paint", field_type: "checkbox" },
    { applies_to: "job", field_key: "color_notes", field_label: "Color / brand", field_type: "text" },
    { applies_to: "job", field_key: "primer_needed", field_label: "Primer needed", field_type: "checkbox" },
  ],
  handyman: [
    { applies_to: "job", field_key: "repair_description", field_label: "Repair description", field_type: "long_text" },
    { applies_to: "job", field_key: "materials_supplied", field_label: "Customer supplying materials", field_type: "checkbox" },
    { applies_to: "job", field_key: "ladder_needed", field_label: "Ladder needed", field_type: "checkbox" },
    { applies_to: "job", field_key: "estimated_hours", field_label: "Estimated labor hours", field_type: "number" },
  ],
  hvac: [
    { applies_to: "job", field_key: "system_type", field_label: "System type", field_type: "dropdown", options: ["Central AC","Heat pump","Furnace","Mini-split","Package unit"] },
    { applies_to: "job", field_key: "brand", field_label: "Brand", field_type: "text" },
    { applies_to: "job", field_key: "model", field_label: "Model number", field_type: "text" },
    { applies_to: "job", field_key: "serial", field_label: "Serial number", field_type: "text" },
    { applies_to: "job", field_key: "filter_size", field_label: "Filter size", field_type: "text" },
    { applies_to: "job", field_key: "system_age_years", field_label: "System age (years)", field_type: "number" },
    { applies_to: "job", field_key: "diagnostic_fee", field_label: "Diagnostic fee", field_type: "currency" },
  ],
  plumbing: [
    { applies_to: "job", field_key: "fixture_type", field_label: "Fixture / system", field_type: "text" },
    { applies_to: "job", field_key: "leak_active", field_label: "Active leak", field_type: "checkbox" },
    { applies_to: "job", field_key: "shutoff_accessible", field_label: "Shutoff accessible", field_type: "checkbox" },
    { applies_to: "job", field_key: "emergency", field_label: "Emergency call", field_type: "checkbox" },
    { applies_to: "job", field_key: "pipe_material", field_label: "Pipe material", field_type: "dropdown", options: ["PEX","Copper","CPVC","Galvanized","Cast iron","PVC"] },
  ],
  electrical: [
    { applies_to: "job", field_key: "device_type", field_label: "Device / fixture", field_type: "text" },
    { applies_to: "job", field_key: "panel_location", field_label: "Panel location", field_type: "text" },
    { applies_to: "job", field_key: "breaker_size", field_label: "Breaker size (amps)", field_type: "number" },
    { applies_to: "job", field_key: "voltage", field_label: "Voltage", field_type: "dropdown", options: ["120V","240V","Both"] },
    { applies_to: "job", field_key: "permit_needed", field_label: "Permit needed", field_type: "checkbox" },
  ],
  pool_service: [
    { applies_to: "job", field_key: "pool_type", field_label: "Pool type", field_type: "dropdown", options: ["In-ground","Above-ground","Spa"] },
    { applies_to: "job", field_key: "pool_size_gal", field_label: "Pool size (gallons)", field_type: "number" },
    { applies_to: "job", field_key: "salt_or_chlorine", field_label: "Salt or chlorine", field_type: "dropdown", options: ["Salt","Chlorine"] },
    { applies_to: "job", field_key: "filter_type", field_label: "Filter type", field_type: "dropdown", options: ["Cartridge","DE","Sand"] },
    { applies_to: "job", field_key: "gate_code", field_label: "Gate code", field_type: "text" },
  ],
  pest_control: [
    { applies_to: "job", field_key: "pest_type", field_label: "Pest type", field_type: "text" },
    { applies_to: "job", field_key: "interior_exterior", field_label: "Interior / exterior", field_type: "dropdown", options: ["Interior","Exterior","Both"] },
    { applies_to: "job", field_key: "kids_or_pets", field_label: "Children or pets present", field_type: "checkbox" },
    { applies_to: "job", field_key: "recurring_plan", field_label: "Recurring plan", field_type: "checkbox" },
  ],
  junk_removal: [
    { applies_to: "job", field_key: "load_size", field_label: "Load size", field_type: "dropdown", options: ["1/8","1/4","1/2","3/4","Full truck"] },
    { applies_to: "job", field_key: "stairs", field_label: "Stairs involved", field_type: "checkbox" },
    { applies_to: "job", field_key: "heavy_items", field_label: "Heavy items", field_type: "checkbox" },
    { applies_to: "job", field_key: "donation_items", field_label: "Donation items in load", field_type: "checkbox" },
  ],
  roofing: [
    { applies_to: "job", field_key: "roof_type", field_label: "Roof type", field_type: "dropdown", options: ["Asphalt shingle","Metal","Tile","Flat / TPO","Wood shake"] },
    { applies_to: "job", field_key: "stories", field_label: "Number of stories", field_type: "number" },
    { applies_to: "job", field_key: "pitch", field_label: "Pitch", field_type: "dropdown", options: ["Low","Medium","Steep"] },
    { applies_to: "job", field_key: "leak_location", field_label: "Leak location", field_type: "text" },
    { applies_to: "job", field_key: "insurance_claim", field_label: "Insurance claim involved", field_type: "checkbox" },
  ],
  appliance_repair: [
    { applies_to: "job", field_key: "appliance_type", field_label: "Appliance type", field_type: "text" },
    { applies_to: "job", field_key: "brand", field_label: "Brand", field_type: "text" },
    { applies_to: "job", field_key: "model", field_label: "Model", field_type: "text" },
    { applies_to: "job", field_key: "serial", field_label: "Serial", field_type: "text" },
    { applies_to: "job", field_key: "error_code", field_label: "Error code", field_type: "text" },
    { applies_to: "job", field_key: "warranty", field_label: "Under warranty", field_type: "checkbox" },
  ],
  window_cleaning: [
    { applies_to: "job", field_key: "window_count", field_label: "Window count", field_type: "number" },
    { applies_to: "job", field_key: "stories", field_label: "Stories", field_type: "number" },
    { applies_to: "job", field_key: "interior_exterior", field_label: "Interior / exterior", field_type: "dropdown", options: ["Interior","Exterior","Both"] },
    { applies_to: "job", field_key: "screens_included", field_label: "Screens included", field_type: "checkbox" },
    { applies_to: "job", field_key: "hard_water", field_label: "Hard water stains", field_type: "checkbox" },
  ],
  gutter_cleaning: [
    { applies_to: "job", field_key: "gutter_length_ft", field_label: "Gutter length (linear ft)", field_type: "number" },
    { applies_to: "job", field_key: "stories", field_label: "Stories", field_type: "number" },
    { applies_to: "job", field_key: "guards_installed", field_label: "Gutter guards installed", field_type: "checkbox" },
    { applies_to: "job", field_key: "downspouts_clogged", field_label: "Downspouts clogged", field_type: "checkbox" },
  ],
  carpet_cleaning: [
    { applies_to: "job", field_key: "rooms", field_label: "Rooms", field_type: "number" },
    { applies_to: "job", field_key: "square_footage", field_label: "Square footage", field_type: "number" },
    { applies_to: "job", field_key: "stains", field_label: "Stains", field_type: "checkbox" },
    { applies_to: "job", field_key: "pet_odor", field_label: "Pet odor", field_type: "checkbox" },
    { applies_to: "job", field_key: "stairs", field_label: "Stairs", field_type: "checkbox" },
  ],
  mobile_detailing: [
    { applies_to: "job", field_key: "vehicle_type", field_label: "Vehicle type", field_type: "dropdown", options: ["Sedan","SUV","Truck","Van","Motorcycle","RV"] },
    { applies_to: "job", field_key: "package", field_label: "Service level", field_type: "dropdown", options: ["Exterior wash","Interior detail","Full detail"] },
    { applies_to: "job", field_key: "pet_hair", field_label: "Pet hair", field_type: "checkbox" },
    { applies_to: "job", field_key: "stains", field_label: "Interior stains", field_type: "checkbox" },
  ],
  landscaping: [
    { applies_to: "job", field_key: "design_help", field_label: "Design help needed", field_type: "checkbox" },
    { applies_to: "job", field_key: "irrigation_present", field_label: "Irrigation present", field_type: "checkbox" },
    { applies_to: "job", field_key: "sun_shade", field_label: "Sun / shade", field_type: "dropdown", options: ["Full sun","Partial","Full shade","Mixed"] },
    { applies_to: "job", field_key: "drainage_issues", field_label: "Drainage issues", field_type: "checkbox" },
    { applies_to: "job", field_key: "budget_range", field_label: "Customer budget range", field_type: "currency" },
  ],
  dryer_vent: [
    { applies_to: "job", field_key: "dryer_location", field_label: "Dryer location", field_type: "text" },
    { applies_to: "job", field_key: "vent_exit", field_label: "Vent exits", field_type: "dropdown", options: ["Wall","Roof","Soffit","Other"] },
    { applies_to: "job", field_key: "stories", field_label: "Stories", field_type: "number" },
    { applies_to: "job", field_key: "bird_nest_suspected", field_label: "Bird nest suspected", field_type: "checkbox" },
  ],
  holiday_lights: [
    { applies_to: "job", field_key: "roofline_length_ft", field_label: "Roofline length (ft)", field_type: "number" },
    { applies_to: "job", field_key: "stories", field_label: "Stories", field_type: "number" },
    { applies_to: "job", field_key: "lights_supplied_by", field_label: "Lights supplied by", field_type: "dropdown", options: ["Customer","Contractor"] },
    { applies_to: "job", field_key: "trees_included", field_label: "Trees / bushes included", field_type: "checkbox" },
    { applies_to: "job", field_key: "removal_date", field_label: "Removal date", field_type: "date" },
  ],
  general_home: [],
  tree_service: [
    { applies_to: "job", field_key: "tree_count", field_label: "Number of trees", field_type: "number" },
    { applies_to: "job", field_key: "tree_size", field_label: "Tree size", field_type: "dropdown", options: ["Small (<25 ft)","Medium (25-50 ft)","Large (50-75 ft)","Very large (>75 ft)"] },
    { applies_to: "job", field_key: "tree_species", field_label: "Species / type", field_type: "text" },
    { applies_to: "job", field_key: "near_structure", field_label: "Near house or power lines", field_type: "checkbox" },
    { applies_to: "job", field_key: "crane_needed", field_label: "Crane needed", field_type: "checkbox" },
    { applies_to: "job", field_key: "stump_grinding", field_label: "Stump grinding included", field_type: "checkbox" },
    { applies_to: "job", field_key: "haul_debris", field_label: "Haul debris off-site", field_type: "checkbox" },
  ],
  fencing: [
    { applies_to: "job", field_key: "linear_ft", field_label: "Linear feet", field_type: "number" },
    { applies_to: "job", field_key: "fence_material", field_label: "Material", field_type: "dropdown", options: ["Wood","Vinyl","Chain link","Aluminum","Iron","Composite"] },
    { applies_to: "job", field_key: "fence_height_ft", field_label: "Height (ft)", field_type: "number" },
    { applies_to: "job", field_key: "gate_count", field_label: "Number of gates", field_type: "number" },
    { applies_to: "job", field_key: "removal_required", field_label: "Existing fence removal", field_type: "checkbox" },
    { applies_to: "job", field_key: "permit_required", field_label: "Permit required", field_type: "checkbox" },
    { applies_to: "job", field_key: "hoa_approval", field_label: "HOA approval needed", field_type: "checkbox" },
  ],
  snow_removal: [
    { applies_to: "property", field_key: "driveway_length_ft", field_label: "Driveway length (ft)", field_type: "number" },
    { applies_to: "property", field_key: "lot_type", field_label: "Lot type", field_type: "dropdown", options: ["Residential","Commercial","HOA"] },
    { applies_to: "job", field_key: "snow_depth_in", field_label: "Snow depth (inches)", field_type: "number" },
    { applies_to: "job", field_key: "salt_included", field_label: "Salt / de-ice included", field_type: "checkbox" },
    { applies_to: "job", field_key: "sidewalks_included", field_label: "Sidewalks included", field_type: "checkbox" },
    { applies_to: "job", field_key: "billing_mode", field_label: "Billing mode", field_type: "dropdown", options: ["Per visit","Per inch","Seasonal contract"] },
  ],
  garage_door: [
    { applies_to: "job", field_key: "door_size", field_label: "Door size", field_type: "dropdown", options: ["Single (8-9 ft)","Single (10 ft)","Double (16 ft)","Double (18 ft)"] },
    { applies_to: "job", field_key: "spring_type", field_label: "Spring type", field_type: "dropdown", options: ["Torsion","Extension","Unknown"] },
    { applies_to: "job", field_key: "opener_brand", field_label: "Opener brand", field_type: "text" },
    { applies_to: "job", field_key: "issue", field_label: "Issue description", field_type: "long_text" },
    { applies_to: "job", field_key: "door_age_years", field_label: "Door age (years)", field_type: "number" },
  ],
  concrete: [
    { applies_to: "job", field_key: "sq_ft", field_label: "Square footage", field_type: "number" },
    { applies_to: "job", field_key: "concrete_type", field_label: "Type of work", field_type: "dropdown", options: ["Driveway","Patio","Sidewalk","Steps","Foundation","Other"] },
    { applies_to: "job", field_key: "finish", field_label: "Finish", field_type: "dropdown", options: ["Broom","Smooth","Stamped","Exposed aggregate","Polished"] },
    { applies_to: "job", field_key: "demo_required", field_label: "Demolition / removal required", field_type: "checkbox" },
    { applies_to: "job", field_key: "rebar_required", field_label: "Rebar / mesh required", field_type: "checkbox" },
    { applies_to: "job", field_key: "permit_required", field_label: "Permit required", field_type: "checkbox" },
  ],
  irrigation: [
    { applies_to: "property", field_key: "zones", field_label: "Number of zones", field_type: "number" },
    { applies_to: "job", field_key: "controller_brand", field_label: "Controller brand", field_type: "text" },
    { applies_to: "job", field_key: "water_source", field_label: "Water source", field_type: "dropdown", options: ["City","Well","Reclaimed"] },
    { applies_to: "job", field_key: "head_type", field_label: "Head type", field_type: "dropdown", options: ["Spray","Rotor","Drip","Mixed"] },
    { applies_to: "job", field_key: "leak_active", field_label: "Active leak", field_type: "checkbox" },
    { applies_to: "job", field_key: "backflow_present", field_label: "Backflow preventer present", field_type: "checkbox" },
  ],
  epoxy_flooring: [
    { applies_to: "job", field_key: "sq_ft", field_label: "Square footage", field_type: "number" },
    { applies_to: "job", field_key: "coating_type", field_label: "Coating type", field_type: "dropdown", options: ["Epoxy","Polyaspartic","Polyurea","Polished concrete"] },
    { applies_to: "job", field_key: "flake_color", field_label: "Flake / color", field_type: "text" },
    { applies_to: "job", field_key: "moisture_test", field_label: "Moisture test required", field_type: "checkbox" },
    { applies_to: "job", field_key: "crack_repair", field_label: "Crack repair required", field_type: "checkbox" },
    { applies_to: "job", field_key: "grinding_required", field_label: "Concrete grinding required", field_type: "checkbox" },
  ],
  solar_install: [
    { applies_to: "property", field_key: "panel_count", field_label: "Number of panels", field_type: "number" },
    { applies_to: "property", field_key: "system_kw", field_label: "System size (kW)", field_type: "number" },
    { applies_to: "job", field_key: "inverter_type", field_label: "Inverter type", field_type: "dropdown", options: ["String","Microinverter","Hybrid"] },
    { applies_to: "job", field_key: "battery_included", field_label: "Battery backup included", field_type: "checkbox" },
    { applies_to: "job", field_key: "roof_type", field_label: "Roof type", field_type: "dropdown", options: ["Composite shingle","Metal","Tile","Flat / TPO"] },
    { applies_to: "job", field_key: "permit_status", field_label: "Permit status", field_type: "dropdown", options: ["Not started","Submitted","Approved","Inspected"] },
    { applies_to: "job", field_key: "utility", field_label: "Utility company", field_type: "text" },
  ],
  chimney_sweep: [
    { applies_to: "job", field_key: "fireplace_type", field_label: "Fireplace type", field_type: "dropdown", options: ["Wood-burning","Gas","Pellet","Insert"] },
    { applies_to: "job", field_key: "chimney_height_ft", field_label: "Chimney height (ft)", field_type: "number" },
    { applies_to: "job", field_key: "creosote_level", field_label: "Creosote level", field_type: "dropdown", options: ["Light","Moderate","Heavy","Glazed"] },
    { applies_to: "job", field_key: "cap_present", field_label: "Cap present", field_type: "checkbox" },
    { applies_to: "job", field_key: "animal_concern", field_label: "Animal in chimney", field_type: "checkbox" },
    { applies_to: "job", field_key: "level2_inspection", field_label: "Level 2 inspection requested", field_type: "checkbox" },
  ],
};

export function getCustomFieldDefaultsForTrade(business_type_id: string): CustomFieldDefault[] {
  return DEFAULT_CUSTOM_FIELDS_BY_TRADE[business_type_id] ?? [];
}

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
  tree_service: TREE_SERVICE,
  fencing: FENCING,
  snow_removal: SNOW_REMOVAL,
  garage_door: GARAGE_DOOR,
  concrete: CONCRETE,
  irrigation: IRRIGATION,
  epoxy_flooring: EPOXY_FLOORING,
  solar_install: SOLAR_INSTALL,
  chimney_sweep: CHIMNEY_SWEEP,
};

export function getDefaultsForTrade(business_type_id: string): DefaultService[] {
  return DEFAULT_SERVICES_BY_TRADE[business_type_id] ?? GENERAL_HOME;
}

// Per-trade form config — which optional fields the service editor renders.
// Trades that don't deal with materials (lawn care, plumbing) hide the
// material modifier grid; trades that aren't multi-story hide the height
// modifier; trades that don't bill by area hide sqft/linear_ft pricing.
export type ServiceFormConfig = {
  showMaterialModifiers: boolean;
  showHeightModifier: boolean;
  showPricePerSqft: boolean;
  showPricePerLinearFt: boolean;
  materials: string[];
};

const DEFAULT_FORM_CONFIG: ServiceFormConfig = {
  showMaterialModifiers: false,
  showHeightModifier: false,
  showPricePerSqft: false,
  showPricePerLinearFt: false,
  materials: [],
};

const FORM_CONFIG_BY_TRADE: Record<string, Partial<ServiceFormConfig>> = {
  pressure_washing: {
    showMaterialModifiers: true,
    showHeightModifier: true,
    showPricePerSqft: true,
    showPricePerLinearFt: true,
    materials: ["concrete","brick","stucco","vinyl","wood","composite","roof_shingle","roof_tile","pavers"],
  },
  painting: {
    showHeightModifier: true,
    showPricePerSqft: true,
    showPricePerLinearFt: true,
  },
  roofing: {
    showHeightModifier: true,
  },
  gutter_cleaning: {
    showHeightModifier: true,
    showPricePerLinearFt: true,
  },
  window_cleaning: {
    showHeightModifier: true,
  },
  holiday_lights: {
    showHeightModifier: true,
    showPricePerLinearFt: true,
  },
  landscaping: {
    showPricePerSqft: true,
  },
  carpet_cleaning: {
    showPricePerSqft: true,
  },
  house_cleaning: {
    showPricePerSqft: true,
  },
  tree_service: {
    showHeightModifier: true,
  },
  fencing: {
    showPricePerLinearFt: true,
    materials: ["wood","vinyl","chain_link","aluminum","iron","composite"],
    showMaterialModifiers: true,
  },
  snow_removal: {
    showPricePerLinearFt: true,
  },
  concrete: {
    showPricePerSqft: true,
    showPricePerLinearFt: true,
    materials: ["concrete","pavers","brick","stone"],
    showMaterialModifiers: true,
  },
  irrigation: {
    showPricePerLinearFt: true,
  },
  epoxy_flooring: {
    showPricePerSqft: true,
  },
  solar_install: {
    showHeightModifier: true,
  },
  chimney_sweep: {
    showHeightModifier: true,
  },
  // Trades not listed (lawn_care, plumbing, electrical, hvac, pool_service,
  // pest_control, junk_removal, mobile_detailing, appliance_repair,
  // dryer_vent, handyman, general_home, garage_door) get DEFAULT_FORM_CONFIG
  // — no material modifiers, no height, no per-area pricing fields.
};

export function getFormConfigForTrade(business_type_id: string): ServiceFormConfig {
  const overrides = FORM_CONFIG_BY_TRADE[business_type_id] ?? {};
  return { ...DEFAULT_FORM_CONFIG, ...overrides };
}

// Union form config across multiple trades — any feature enabled by ANY of
// the selected trades is enabled. Materials list dedupes across them.
export function getFormConfigForTrades(business_type_ids: string[]): ServiceFormConfig {
  if (business_type_ids.length === 0) return DEFAULT_FORM_CONFIG;
  const cfgs = business_type_ids.map(getFormConfigForTrade);
  const materials = Array.from(new Set(cfgs.flatMap((c) => c.materials)));
  return {
    showMaterialModifiers: cfgs.some((c) => c.showMaterialModifiers),
    showHeightModifier: cfgs.some((c) => c.showHeightModifier),
    showPricePerSqft: cfgs.some((c) => c.showPricePerSqft),
    showPricePerLinearFt: cfgs.some((c) => c.showPricePerLinearFt),
    materials,
  };
}

// Combined default service catalog across multiple trades, deduped by name
// (case-insensitive) so House Wash from pressure_washing doesn't conflict
// with a similarly-named entry from another trade.
export function getDefaultsForTrades(business_type_ids: string[]): DefaultService[] {
  const seen = new Set<string>();
  const out: DefaultService[] = [];
  for (const id of business_type_ids) {
    for (const d of getDefaultsForTrade(id)) {
      const key = d.name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(d);
    }
  }
  return out;
}

export function getCustomFieldDefaultsForTrades(business_type_ids: string[]): CustomFieldDefault[] {
  const seen = new Set<string>();
  const out: CustomFieldDefault[] = [];
  for (const id of business_type_ids) {
    for (const f of getCustomFieldDefaultsForTrade(id)) {
      const key = `${f.applies_to}:${f.field_key}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(f);
    }
  }
  return out;
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
