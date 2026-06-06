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
}

export default function StaffSidebar({ user }: StaffSidebarProps) {
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
      <Link href="/dashboard" className="staff-brand">
        <span className="staff-brand-mark" aria-hidden="true">F</span>
        <span>
          <div className="staff-brand-name">FOI Manager</div>
          <div className="staff-brand-sub">Internal workbench</div>
        </span>
      </Link>

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
          </Link>
        ))}
      </nav>

      <div className="staff-user">
        <Avatar initials={initials} name={`${user.first_name} ${user.last_name}`} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#ffffff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {user.first_name} {user.last_name}
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {user.department}
          </div>
        </div>
        <NotificationBell />
        <button
          onClick={handleSignOut}
          title="Sign out"
          style={{ background: "none", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: 14, padding: 4 }}
          aria-label="Sign out"
        >
          ⎋
        </button>
      </div>
    </aside>
  );
}
