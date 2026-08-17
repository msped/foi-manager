"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import Header from "./govuk/Header";
import ServiceNavigation, { type NavItem } from "./govuk/ServiceNavigation";
import NotificationBell from "./ui/NotificationBell";
import { authClient } from "@/lib/auth-client";
import { branding } from "@/lib/branding";
import type { ApiUser } from "@/lib/types";

export interface NavDefinition {
  href: string;
  text: string;
  /** Only `/dashboard` should match exactly; the rest match by section. */
  exact?: boolean;
}

interface AppHeaderProps {
  user: ApiUser;
  nav: NavDefinition[];
  homepageUrl: string;
  showNotifications?: boolean;
}

export default function AppHeader({
  user,
  nav,
  homepageUrl,
  showNotifications = false,
}: AppHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();

  function handleSignOut() {
    authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push("/login");
          router.refresh();
        },
      },
    });
  }

  const navigation: NavItem[] = nav.map((item) => {
    const isCurrent = pathname === item.href;
    const isActive = !item.exact && pathname.startsWith(item.href);
    return { href: item.href, text: item.text, current: isCurrent, active: isActive };
  });

  return (
    <>
      <Header
        homepageUrl={homepageUrl}
        organisationName={branding.organisationName}
        actions={
          <>
            {showNotifications && <NotificationBell />}
            <Link className="foi-header__link" href="/account">
              {user.first_name} {user.last_name}
            </Link>
            <button type="button" className="foi-header__link" onClick={handleSignOut}>
              Sign out
            </button>
          </>
        }
      />
      <ServiceNavigation
        serviceName={branding.serviceName}
        serviceUrl={homepageUrl}
        navigation={navigation}
      />
    </>
  );
}
