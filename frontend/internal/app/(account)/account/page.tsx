import PageHeader from "@/components/govuk/PageHeader";
import { getNotificationPreferences } from "@/lib/services/users";
import AccountSettings from "@/components/ui/AccountSettings";

export default async function AccountPage() {
  const preferences = await getNotificationPreferences();

  return (
    <>
      <PageHeader title="Account settings" />
      <div className="govuk-grid-row">
        <div className="govuk-grid-column-one-half">
          <AccountSettings preferences={preferences} />
        </div>
      </div>
    </>
  );
}
