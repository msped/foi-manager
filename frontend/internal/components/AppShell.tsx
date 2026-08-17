import SkipLink from "./govuk/SkipLink";
import Footer from "./govuk/Footer";
import AppHeader, { type NavDefinition } from "./AppHeader";
import type { ApiUser } from "@/lib/types";

interface AppShellProps {
  user: ApiUser;
  nav: NavDefinition[];
  homepageUrl: string;
  showNotifications?: boolean;
  children: React.ReactNode;
}

/** The standard GOV.UK page structure: skip link, header, main, footer. */
export default function AppShell({
  user,
  nav,
  homepageUrl,
  showNotifications,
  children,
}: AppShellProps) {
  return (
    <>
      <SkipLink />
      <AppHeader
        user={user}
        nav={nav}
        homepageUrl={homepageUrl}
        showNotifications={showNotifications}
      />
      <div className="govuk-width-container">
        <main className="govuk-main-wrapper" id="main-content">
          {children}
        </main>
      </div>
      <Footer />
    </>
  );
}
