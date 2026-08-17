import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import { ASSIGNEE_NAV, STAFF_NAV } from "@/lib/nav";
import { getMe } from "@/lib/services/users";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  let user;
  try {
    user = await getMe();
  } catch {
    redirect("/api/force-logout");
  }

  const isFoiTeam = user.role === "foi_team";

  return (
    <AppShell
      user={user}
      nav={isFoiTeam ? STAFF_NAV : ASSIGNEE_NAV}
      homepageUrl={isFoiTeam ? "/dashboard" : "/consultations"}
      showNotifications={isFoiTeam}
    >
      {children}
    </AppShell>
  );
}
