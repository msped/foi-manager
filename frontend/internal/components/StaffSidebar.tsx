"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Avatar from "./ui/Avatar";
import NotificationBell from "./ui/NotificationBell";
import { authClient } from "@/lib/auth-client";
import type { ApiUser } from "@/lib/types";

const NAV_MAIN = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/cases",     label: "Cases" },
  { href: "/publish",   label: "Publish to portal" },
  { href: "/analytics", label: "Analytics" },
];

const NAV_LIBRARY = [
  { href: "/disclosure", label: "Disclosure log" },
];

const NAV_ADMIN = [
  { href: "/settings", label: "Settings" },
];

interface StaffSidebarProps {
  user: ApiUser;
  hasMissingTemplates?: boolean;
}

export default function StaffSidebar({ user, hasMissingTemplates }: StaffSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  }

  function handleSignOut() {
    authClient.signOut({
      fetchOptions: { onSuccess: () => { router.push("/login"); router.refresh(); } },
    });
  }

  const initials = `${user.first_name[0] ?? ""}${user.last_name[0] ?? ""}`.toUpperCase();

  return (
    <aside className="staff-sidebar">
      <div style={{ display: "flex", alignItems: "center" }}>
        <Link href="/dashboard" className="staff-brand" style={{ flex: 1 }}>
          <span className="staff-brand-mark" aria-hidden="true">F</span>
          <span>
            <div className="staff-brand-name">FOI Manager</div>
            <div className="staff-brand-sub">Internal workbench</div>
          </span>
        </Link>
        <div style={{ marginRight: 8 }}>
          <NotificationBell />
        </div>
      </div>

      <nav className="staff-nav" aria-label="Main navigation">
        <div className="staff-nav-section">Workspace</div>
        {NAV_MAIN.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={`staff-nav-item${isActive(n.href) ? " active" : ""}`}
            aria-current={isActive(n.href) ? "page" : undefined}
          >
            {n.label}
          </Link>
        ))}

        <div className="staff-nav-section">Library</div>
        {NAV_LIBRARY.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={`staff-nav-item${isActive(n.href) ? " active" : ""}`}
            aria-current={isActive(n.href) ? "page" : undefined}
          >
            {n.label}
          </Link>
        ))}

        <div className="staff-nav-section">Admin</div>
        {NAV_ADMIN.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            className={`staff-nav-item${isActive(n.href) ? " active" : ""}`}
            aria-current={isActive(n.href) ? "page" : undefined}
          >
            {n.label}
            {n.href === "/settings" && hasMissingTemplates && (
              <span className="nav-badge" style={{ background: "#d4351c", color: "#fff" }}>Action needed</span>
            )}
          </Link>
        ))}
      </nav>

      <div className="staff-user">
        <Avatar initials={initials} name={`${user.first_name} ${user.last_name}`} />
        <div
          style={{ flex: 1, minWidth: 0 }}
          title={`${user.first_name} ${user.last_name}`}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: "#ffffff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {user.first_name}
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {user.department}
          </div>
        </div>
        <Link
          href="/account"
          title="Account settings"
          aria-label="Account settings"
          style={{ color: "rgba(255,255,255,0.5)", display: "flex", alignItems: "center", padding: 6 }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96a7.01 7.01 0 0 0-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.47.47 0 0 0-.59.22L2.74 8.87a.47.47 0 0 0 .12.61l2.03 1.58c-.05.3-.07.63-.07.94s.02.64.07.94l-2.03 1.58a.47.47 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.47.47 0 0 0-.12-.61l-2.01-1.58zM12 15.6a3.6 3.6 0 1 1 0-7.2 3.6 3.6 0 0 1 0 7.2z"/>
          </svg>
        </Link>
        <button
          onClick={handleSignOut}
          title="Sign out"
          style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer", padding: 6, display: "flex", alignItems: "center" }}
          aria-label="Sign out"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5-5-5zm-11 1H4v12h12v-4h-2v2H6V8h2V6H6z"/>
          </svg>
        </button>
      </div>
    </aside>
  );
}
