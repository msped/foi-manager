"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Avatar from "./ui/Avatar";
import { authClient } from "@/lib/auth-client";
import type { ApiUser } from "@/lib/types";

function SettingsCogIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96a7.01 7.01 0 0 0-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.47.47 0 0 0-.59.22L2.74 8.87a.47.47 0 0 0 .12.61l2.03 1.58c-.05.3-.07.63-.07.94s.02.64.07.94l-2.03 1.58a.47.47 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.47.47 0 0 0-.12-.61l-2.01-1.58zM12 15.6a3.6 3.6 0 1 1 0-7.2 3.6 3.6 0 0 1 0 7.2z"/>
    </svg>
  );
}

interface Props {
  user: ApiUser;
}

export default function AssigneeSidebar({ user }: Props) {
  const pathname = usePathname();
  const router = useRouter();

  function handleSignOut() {
    authClient.signOut({
      fetchOptions: { onSuccess: () => { router.push("/login"); router.refresh(); } },
    });
  }

  const initials = `${user.first_name[0] ?? ""}${user.last_name[0] ?? ""}`.toUpperCase();

  return (
    <aside className="staff-sidebar">
      <div className="staff-brand">
        <span className="staff-brand-mark" aria-hidden="true">F</span>
        <span>
          <div className="staff-brand-name">FOI Manager</div>
          <div className="staff-brand-sub">Consultation portal</div>
        </span>
      </div>

      <nav className="staff-nav" aria-label="Main navigation">
        <div className="staff-nav-section">My work</div>
        <Link
          href="/consultations"
          className={`staff-nav-item${pathname.startsWith("/consultations") ? " active" : ""}`}
          aria-current={pathname.startsWith("/consultations") ? "page" : undefined}
        >
          My Consultations
        </Link>
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
        <Link
          href="/account"
          title="Account settings"
          aria-label="Account settings"
          style={{ color: "rgba(255,255,255,0.5)", display: "flex", alignItems: "center", padding: 4 }}
        >
          <SettingsCogIcon />
        </Link>
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
