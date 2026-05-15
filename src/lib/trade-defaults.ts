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
  // Trades not listed (lawn_care, plumbing, electrical, hvac, pool_service,
  // pest_control, junk_removal, mobile_detailing, appliance_repair,
  // dryer_vent, handyman, general_home) get DEFAULT_FORM_CONFIG — no material
  // modifiers, no height, no per-area pricing fields.
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
