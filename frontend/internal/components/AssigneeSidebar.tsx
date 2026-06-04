"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Avatar from "./ui/Avatar";
import { authClient } from "@/lib/auth-client";
import type { ApiUser } from "@/lib/types";

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
