import type { NavDefinition } from "@/components/AppHeader";

export const STAFF_NAV: NavDefinition[] = [
  { href: "/dashboard", text: "Dashboard", exact: true },
  { href: "/cases", text: "Cases" },
  { href: "/publish", text: "Publish to portal" },
  { href: "/analytics", text: "Analytics" },
  { href: "/disclosure", text: "Disclosure log" },
  { href: "/settings", text: "Settings" },
];

export const ASSIGNEE_NAV: NavDefinition[] = [
  { href: "/consultations", text: "My consultations" },
];
