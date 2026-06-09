import { getNotificationPreferences } from "@/lib/services/users";
import AccountSettings from "@/components/ui/AccountSettings";

export default async function AccountPage() {
  const preferences = await getNotificationPreferences();

  return (
    <div className="staff-body">
      <h1 className="govuk-heading-m">Account settings</h1>
      <div style={{ maxWidth: 480 }}>
        <AccountSettings preferences={preferences} />
      </div>
    </div>
  );
}
