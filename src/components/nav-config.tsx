import type { ReactNode } from "react";

export type NavLeaf = { href: string; label: string };
export type NavGroup = {
  key: string;
  n: number;
  label: string;
  icon: ReactNode;
  children: NavLeaf[];
};

export const NAV_GROUPS: NavGroup[] = [
  {
    key: "dashboard",
    n: 1,
    label: "Dashboard",
    icon: <DashboardIcon />,
    children: [
      { href: "/dashboard#overview", label: "Overview" },
      { href: "/dashboard#kpis", label: "KPIs" },
      { href: "/dashboard#alerts", label: "Alerts" },
      { href: "/dashboard#this-week", label: "This Week's Jobs" },
      { href: "/dashboard#alerts", label: "Quick Actions" },
    ],
  },
  {
    key: "customers",
    n: 2,
    label: "Customers",
    icon: <UsersIcon />,
    children: [
      { href: "/customers", label: "Customer List" },
      { href: "/properties", label: "Properties" },
      { href: "/contracts", label: "Contracts" },
      { href: "/waivers", label: "Waivers" },
    ],
  },
  {
    key: "estimates_jobs",
    n: 3,
    label: "Estimates & Jobs",
    icon: <ClipboardIcon />,
    children: [
      { href: "/estimates/new", label: "New Estimate" },
      { href: "/estimates", label: "Estimate Pipeline" },
      { href: "/calendar", label: "Job Calendar" },
      { href: "/jobs", label: "Job Status" },
    ],
  },
  {
    key: "invoices_payments",
    n: 4,
    label: "Invoices & Payments",
    icon: <DollarIcon />,
    children: [
      { href: "/invoices/new", label: "New Invoice" },
      { href: "/invoices", label: "Invoices" },
      { href: "/invoices?status=sent", label: "Outstanding Balances" },
      { href: "/payments", label: "Receipts" },
    ],
  },
  {
    key: "operations",
    n: 5,
    label: "Operations",
    icon: <SlidersIcon />,
    children: [
      { href: "/services", label: "Services & Pricing" },
      { href: "/measure", label: "Satellite Measurements" },
      { href: "/chemicals", label: "Chemicals" },
      { href: "/mix", label: "Mix Calculator" },
      { href: "/equipment", label: "Equipment" },
    ],
  },
  {
    key: "marketing_reports",
    n: 6,
    label: "Marketing & Reports",
    icon: <BarChartIcon />,
    children: [
      { href: "/leads", label: "Leads" },
      { href: "/campaigns", label: "Campaigns" },
      { href: "/reports", label: "Reports Dashboard" },
      { href: "/accounting", label: "Profit & Loss" },
      { href: "/expenses", label: "Expenses" },
    ],
  },
];

export function DashboardIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

export function UsersIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

export function ClipboardIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="2" width="6" height="4" rx="1" />
      <path d="M9 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-3" />
      <path d="M9 14l2 2 4-4" />
    </svg>
  );
}

export function DollarIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="2" x2="12" y2="22" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}

export function SlidersIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="21" x2="4" y2="14" />
      <line x1="4" y1="10" x2="4" y2="3" />
      <line x1="12" y1="21" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12" y2="3" />
      <line x1="20" y1="21" x2="20" y2="16" />
      <line x1="20" y1="12" x2="20" y2="3" />
      <line x1="1" y1="14" x2="7" y2="14" />
      <line x1="9" y1="8" x2="15" y2="8" />
      <line x1="17" y1="16" x2="23" y2="16" />
    </svg>
  );
}

export function BarChartIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}
