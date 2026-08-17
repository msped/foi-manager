export interface PublicNavItem {
  href: string;
  text: string;
  /** Only the home link should match exactly; the rest match by section. */
  exact?: boolean;
}

export const PUBLIC_NAV: PublicNavItem[] = [
  { href: "/", text: "Home", exact: true },
  { href: "/request", text: "Make a request" },
  { href: "/disclosure-log", text: "Disclosure log" },
];
