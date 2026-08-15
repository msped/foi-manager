import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { listRequesterCategories, listBankHolidays, listMailboxes, listEmailTemplatePurposes, listResponseTemplates } from "@/lib/services/cases";
import { getMe, listUsers } from "@/lib/services/users";
import RequesterCategoriesManager from "./RequesterCategoriesManager";
import BankHolidaysManager from "./BankHolidaysManager";
import MailboxesManager from "./MailboxesManager";
import EmailTemplatesManager from "./EmailTemplatesManager";
import ResponseTemplatesManager from "./ResponseTemplatesManager";
import UsersManager from "./UsersManager";

export const metadata: Metadata = { title: "Settings — FOI Manager" };

export default async function SettingsPage() {
  const me = await getMe();
  if (me.role !== "foi_team") redirect("/dashboard");

  const [categories, bankHolidays, mailboxes, emailTemplatePurposes, responseTemplates, users] = await Promise.all([
    listRequesterCategories().catch(() => []),
    listBankHolidays().catch(() => []),
    listMailboxes().catch(() => []),
    listEmailTemplatePurposes().catch(() => []),
    listResponseTemplates().catch(() => []),
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
          <ResponseTemplatesManager initial={responseTemplates} />
          <UsersManager initial={users} currentUserId={me.id} />
          <RequesterCategoriesManager initial={categories} />
          <BankHolidaysManager initial={bankHolidays} />
        </div>
      </div>
    </>
  );
}
