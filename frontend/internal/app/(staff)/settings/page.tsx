import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { listRequesterCategories, listBankHolidays, listMailboxes, listEmailTemplatePurposes } from "@/lib/services/cases";
import { getMe, listUsers } from "@/lib/services/users";
import RequesterCategoriesManager from "./RequesterCategoriesManager";
import BankHolidaysManager from "./BankHolidaysManager";
import MailboxesManager from "./MailboxesManager";
import EmailTemplatesManager from "./EmailTemplatesManager";
import UsersManager from "./UsersManager";

export const metadata: Metadata = { title: "Settings — FOI Manager" };

export default async function SettingsPage() {
  const me = await getMe();
  if (me.role !== "foi_team") redirect("/dashboard");

  const [categories, bankHolidays, mailboxes, emailTemplatePurposes, users] = await Promise.all([
    listRequesterCategories().catch(() => []),
    listBankHolidays().catch(() => []),
    listMailboxes().catch(() => []),
    listEmailTemplatePurposes().catch(() => []),
    listUsers().catch(() => []),
  ]);

  return (
    <>
      <header className="staff-header">
        <h1 className="govuk-heading-l" style={{ marginBottom: 0 }}>Settings</h1>
      </header>

      <div className="staff-body">
        <div style={{ maxWidth: 900 }}>
          <MailboxesManager initial={mailboxes} />
          <EmailTemplatesManager initial={emailTemplatePurposes} />
          <UsersManager initial={users} currentUserId={me.id} />
          <RequesterCategoriesManager initial={categories} />
          <BankHolidaysManager initial={bankHolidays} />
        </div>
      </div>
    </>
  );
}
