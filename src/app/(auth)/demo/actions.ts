"use server";

import { getSessionAndOrg } from "@/lib/org";
import { revalidatePath } from "next/cache";

export async function seedDemoData() {
  const { supabase, organizationId } = await getSessionAndOrg();

  // Idempotent — bail if already seeded
  const { count } = await supabase
    .from("customers")
    .select("*", { count: "exact", head: true })
    .eq("organization_id", organizationId);
  if ((count ?? 0) > 0) return { skipped: true };

  // Brand the org as demo
  await supabase.from("organizations").update({
    name: "Acme Home Services (Demo)",
    email: "demo@example.com",
    phone: "(555) 555-0142",
    website: "https://example.com",
    address_line1: "123 Main Street",
    city: "Austin",
    state: "TX",
    postal_code: "78701",
    tax_rate: 0.0825,
    global_min_job_price: 175,
    deposit_threshold: 1000,
    deposit_percentage: 0.25,
    google_review_url: "https://g.page/r/example/review",
    review_request_enabled: true,
    is_demo: true,
  }).eq("id", organizationId);

  // Customers
  const customers = [
    { first_name: "Sarah", last_name: "Mitchell", email: "sarah.m@example.com", phone: "(555) 201-3344", customer_type: "residential", tags: ["repeat", "premium"] },
    { first_name: "Marcus", last_name: "Reyes", email: "marcus.reyes@example.com", phone: "(555) 891-2243", customer_type: "residential" },
    { first_name: "Jennifer", last_name: "Park", email: "jpark@example.com", phone: "(555) 712-9988", customer_type: "residential", tags: ["referral"] },
    { company_name: "Sunset HOA", email: "manager@sunsethoa.example.com", phone: "(555) 443-2211", customer_type: "commercial" },
    { company_name: "Lone Star Cafe", email: "owner@lonestar.example.com", phone: "(555) 332-7766", customer_type: "commercial", tags: ["monthly"] },
  ];
  const { data: insertedCustomers } = await supabase
    .from("customers")
    .insert(customers.map((c) => ({ ...c, organization_id: organizationId })))
    .select("id, first_name, last_name, company_name");
  if (!insertedCustomers) return { error: "Failed to seed customers" };

  // Properties
  const propertyRows = [
    { customer_id: insertedCustomers[0].id, address_line1: "4521 Oak Ridge Dr", city: "Austin", state: "TX", postal_code: "78731", square_footage: 3200, stories: 2 },
    { customer_id: insertedCustomers[1].id, address_line1: "987 Pecan St", city: "Austin", state: "TX", postal_code: "78702", square_footage: 1800, stories: 1 },
    { customer_id: insertedCustomers[2].id, address_line1: "215 Maple Ln", city: "Round Rock", state: "TX", postal_code: "78664", square_footage: 2400, stories: 2 },
    { customer_id: insertedCustomers[3].id, nickname: "Building A", address_line1: "1100 Sunset Cir", city: "Austin", state: "TX", postal_code: "78745", square_footage: 12000 },
    { customer_id: insertedCustomers[4].id, address_line1: "650 South Congress", city: "Austin", state: "TX", postal_code: "78704", square_footage: 4500 },
  ];
  const { data: insertedProperties } = await supabase
    .from("properties")
    .insert(propertyRows.map((p) => ({ ...p, organization_id: organizationId })))
    .select("id, customer_id");

  // Services already seeded by handle_new_user — fetch one for line items
  const { data: services } = await supabase
    .from("services")
    .select("id, name, default_price")
    .eq("organization_id", organizationId);
  const houseWash = services?.find((s) => s.name === "House Wash");
  const driveway = services?.find((s) => s.name === "Driveway Cleaning");
  const roof = services?.find((s) => s.name === "Roof Wash (Soft)");

  // Bump invoice/estimate numbers a bit so they don't all start at 1000
  await supabase.from("organizations").update({ next_invoice_number: 1023, next_estimate_number: 1017 }).eq("id", organizationId);

  // Estimates (one accepted, one sent, one draft)
  const { data: est1 } = await supabase.from("estimates").insert({
    organization_id: organizationId,
    customer_id: insertedCustomers[0].id,
    property_id: insertedProperties?.[0]?.id ?? null,
    estimate_number: "EST-1015",
    status: "accepted",
    issue_date: daysAgo(8),
    expires_at: daysFromNow(22),
    subtotal: 925, tax_rate: 0.0825, tax_amount: 76.31, total: 1001.31,
    duration_minutes: 180, buffer_minutes: 30,
    approval_token: cryptoRandom(),
    sent_at: new Date(daysAgo(7)).toISOString(),
    accepted_at: new Date(daysAgo(5)).toISOString(),
    notes: "Includes house wash + driveway + walkways. Soft wash only on stucco areas.",
  }).select("id").single();

  if (est1 && houseWash && driveway) {
    await supabase.from("estimate_line_items").insert([
      { estimate_id: est1.id, service_id: houseWash.id, description: "Full exterior house wash (soft wash)", quantity: 1, unit_price: 575, total: 575, sort_order: 0 },
      { estimate_id: est1.id, service_id: driveway.id, description: "Driveway + walkway cleaning", quantity: 1, unit_price: 350, total: 350, sort_order: 1 },
    ]);
  }

  const { data: est2 } = await supabase.from("estimates").insert({
    organization_id: organizationId,
    customer_id: insertedCustomers[2].id,
    property_id: insertedProperties?.[2]?.id ?? null,
    estimate_number: "EST-1016",
    status: "sent",
    issue_date: daysAgo(4),
    expires_at: daysFromNow(26),
    subtotal: 1295, tax_rate: 0.0825, tax_amount: 106.84, total: 1401.84,
    duration_minutes: 300, buffer_minutes: 45,
    deposit_amount: 350.46,
    approval_token: cryptoRandom(),
    sent_at: new Date(daysAgo(4)).toISOString(),
    notes: "Roof soft wash with 6-month spot-free guarantee.",
  }).select("id").single();

  if (est2 && roof && houseWash) {
    await supabase.from("estimate_line_items").insert([
      { estimate_id: est2.id, service_id: roof.id, description: "Roof soft wash — full coverage", quantity: 1, unit_price: 720, total: 720, sort_order: 0 },
      { estimate_id: est2.id, service_id: houseWash.id, description: "House wash", quantity: 1, unit_price: 575, total: 575, sort_order: 1 },
    ]);
  }

  // Jobs (one scheduled, one in progress, one completed)
  const { data: jobs } = await supabase.from("jobs").insert([
    {
      organization_id: organizationId, customer_id: insertedCustomers[0].id, property_id: insertedProperties?.[0]?.id,
      title: "House + driveway wash — Mitchell", status: "scheduled",
      scheduled_start: new Date(daysFromNow(2)).toISOString(),
      scheduled_end: new Date(daysFromNow(2, 3)).toISOString(),
      total_amount: 1001.31, estimate_id: est1?.id,
    },
    {
      organization_id: organizationId, customer_id: insertedCustomers[4].id, property_id: insertedProperties?.[4]?.id,
      title: "Storefront monthly wash", status: "in_progress",
      scheduled_start: new Date(daysAgo(0, 2)).toISOString(),
      total_amount: 350,
    },
    {
      organization_id: organizationId, customer_id: insertedCustomers[1].id, property_id: insertedProperties?.[1]?.id,
      title: "Driveway + sidewalk", status: "completed",
      scheduled_start: new Date(daysAgo(6)).toISOString(),
      actual_start: new Date(daysAgo(6)).toISOString(),
      actual_end: new Date(daysAgo(6, -2)).toISOString(),
      total_amount: 425,
    },
  ]).select("id, total_amount, customer_id");

  // Invoices — 1 paid, 1 sent (open), 1 overdue, 1 draft
  const { data: invPaid } = await supabase.from("invoices").insert({
    organization_id: organizationId,
    customer_id: insertedCustomers[1].id,
    invoice_number: "INV-1019",
    status: "paid",
    issue_date: daysAgo(5), due_date: daysFromNow(9),
    subtotal: 425, tax_rate: 0.0825, tax_amount: 35.06, total: 460.06,
    amount_paid: 460.06, balance_due: 0,
    paid_at: new Date(daysAgo(2)).toISOString(),
    job_id: jobs?.[2]?.id,
  }).select("id").single();

  if (invPaid && driveway) {
    await supabase.from("invoice_line_items").insert([
      { invoice_id: invPaid.id, service_id: driveway.id, description: "Driveway + sidewalk cleaning", quantity: 1, unit_price: 425, total: 425, sort_order: 0 },
    ]);
    await supabase.from("payments").insert({
      organization_id: organizationId,
      invoice_id: invPaid.id,
      customer_id: insertedCustomers[1].id,
      amount: 460.06,
      payment_method: "card",
      payment_date: daysAgo(2),
      reference_number: "ending 4242",
    });
  }

  const { data: invSent } = await supabase.from("invoices").insert({
    organization_id: organizationId,
    customer_id: insertedCustomers[3].id,
    invoice_number: "INV-1020",
    status: "sent",
    issue_date: daysAgo(2), due_date: daysFromNow(12),
    subtotal: 1850, tax_rate: 0.0825, tax_amount: 152.63, total: 2002.63, balance_due: 2002.63,
    sent_at: new Date(daysAgo(2)).toISOString(),
  }).select("id").single();

  if (invSent && houseWash) {
    await supabase.from("invoice_line_items").insert([
      { invoice_id: invSent.id, description: "Commercial soft wash — Building A exterior", quantity: 1, unit_price: 1500, total: 1500, sort_order: 0 },
      { invoice_id: invSent.id, description: "Concrete sidewalks (commercial)", quantity: 1, unit_price: 350, total: 350, sort_order: 1 },
    ]);
  }

  const { data: invOverdue } = await supabase.from("invoices").insert({
    organization_id: organizationId,
    customer_id: insertedCustomers[4].id,
    invoice_number: "INV-1021",
    status: "overdue",
    issue_date: daysAgo(28), due_date: daysAgo(14),
    subtotal: 350, tax_rate: 0.0825, tax_amount: 28.88, total: 378.88, balance_due: 378.88,
    sent_at: new Date(daysAgo(28)).toISOString(),
  }).select("id").single();

  if (invOverdue) {
    await supabase.from("invoice_line_items").insert([
      { invoice_id: invOverdue.id, description: "Storefront monthly wash", quantity: 1, unit_price: 350, total: 350, sort_order: 0 },
    ]);
  }

  await supabase.from("invoices").insert({
    organization_id: organizationId,
    customer_id: insertedCustomers[2].id,
    invoice_number: "INV-1022",
    status: "draft",
    issue_date: daysAgo(0), due_date: daysFromNow(14),
    subtotal: 250, tax_rate: 0.0825, tax_amount: 20.63, total: 270.63, balance_due: 270.63,
  });

  // Expenses (last 60 days)
  await supabase.from("expenses").insert([
    { organization_id: organizationId, vendor: "Pure Power Wash Supply", amount: 285.40, expense_date: daysAgo(12), description: "12.5% SH x 30 gallons", payment_method: "card", tax_deductible: true },
    { organization_id: organizationId, vendor: "Buc-ee's", amount: 92.18, expense_date: daysAgo(6), description: "Fuel", payment_method: "card", tax_deductible: true },
    { organization_id: organizationId, vendor: "Home Depot", amount: 142.55, expense_date: daysAgo(3), description: "Hoses + fittings", payment_method: "card", tax_deductible: true },
    { organization_id: organizationId, vendor: "State Farm", amount: 145.00, expense_date: daysAgo(20), description: "Commercial auto premium", payment_method: "ach", tax_deductible: true },
    { organization_id: organizationId, vendor: "Google Ads", amount: 320.00, expense_date: daysAgo(15), description: "Local search campaign", payment_method: "card", tax_deductible: true },
    { organization_id: organizationId, vendor: "Buc-ee's", amount: 78.40, expense_date: daysAgo(21), description: "Fuel", payment_method: "card", tax_deductible: true },
  ]);

  // Chemicals
  await supabase.from("chemicals").insert([
    { organization_id: organizationId, name: "12.5% Sodium Hypochlorite", brand: "ChemicalGuys", category: "Oxidizer", unit: "gallon", current_stock: 18, reorder_level: 10, cost_per_unit: 4.50, supplier: "Pure Power", hazard_class: "5.1" },
    { organization_id: organizationId, name: "Apple Wash Surfactant", brand: "Pressure Tek", category: "Surfactant", unit: "gallon", current_stock: 3, reorder_level: 4, cost_per_unit: 22.00, supplier: "Pressure Tek" },
    { organization_id: organizationId, name: "Sodium Hydroxide Degreaser", brand: "F9", category: "Degreaser", unit: "gallon", current_stock: 6, reorder_level: 3, cost_per_unit: 35.00 },
    { organization_id: organizationId, name: "Oxalic Acid (Wood Brightener)", brand: "F9", category: "Acid", unit: "pound", current_stock: 25, reorder_level: 10, cost_per_unit: 4.80 },
  ]);

  // Equipment
  await supabase.from("equipment").insert([
    { organization_id: organizationId, name: "8GPM Pressure Pro Belt-Drive", type: "Pump", serial_number: "PP-883201", purchase_date: daysAgo(420), purchase_price: 3850, current_value: 2500, status: "active", hours_used: 312, next_service_date: daysFromNow(11) },
    { organization_id: organizationId, name: "Whisper Wash 24\" Surface Cleaner", type: "Surface cleaner", purchase_date: daysAgo(280), purchase_price: 720, status: "active" },
    { organization_id: organizationId, name: "300gal Buffer Tank Trailer", type: "Trailer", purchase_date: daysAgo(180), purchase_price: 6200, status: "active" },
    { organization_id: organizationId, name: "12V Soft Wash Pump", type: "Pump", purchase_date: daysAgo(95), purchase_price: 580, status: "maintenance", next_service_date: daysFromNow(3) },
  ]);

  // Leads
  await supabase.from("leads").insert([
    { organization_id: organizationId, first_name: "David", last_name: "Liu", phone: "(555) 901-2255", email: "davidl@example.com", status: "new", estimated_value: 450, address: "1422 Lakeview Dr, Austin" },
    { organization_id: organizationId, first_name: "Erica", last_name: "Vasquez", phone: "(555) 778-4421", status: "contacted", estimated_value: 800, contacted_at: new Date(daysAgo(1)).toISOString() },
    { organization_id: organizationId, first_name: "Tom", last_name: "Brennan", phone: "(555) 110-9982", status: "quoted", estimated_value: 1500 },
    { organization_id: organizationId, company_name: "Cedar Lane Apartments", first_name: "Property", last_name: "Manager", email: "ops@cedarlane.example.com", status: "nurture", estimated_value: 4200 },
  ]);

  // Campaign
  await supabase.from("campaigns").insert([
    { organization_id: organizationId, name: "Spring Google Ads", channel: "Google", start_date: daysAgo(45), end_date: daysFromNow(15), budget: 1500, spent: 820, leads_generated: 11, impressions: 18420, clicks: 312, conversions: 11, status: "active" },
    { organization_id: organizationId, name: "Neighborhood door hangers", channel: "Print", start_date: daysAgo(30), end_date: daysAgo(10), budget: 400, spent: 400, leads_generated: 4, status: "completed" },
  ]);

  revalidatePath("/dashboard");
  return { ok: true };
}

function daysAgo(d: number, hours = 0) {
  const x = new Date();
  x.setDate(x.getDate() - d);
  x.setHours(x.getHours() - hours, 0, 0, 0);
  return x.toISOString().slice(0, 10);
}
function daysFromNow(d: number, hours = 0) {
  const x = new Date();
  x.setDate(x.getDate() + d);
  x.setHours(x.getHours() + hours, 0, 0, 0);
  return x.toISOString();
}
function cryptoRandom() {
  return (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)).replace(/-/g, "");
}
