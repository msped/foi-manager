import type { Metadata } from "next";
import { redirect } from "next/navigation";
import PageHeader from "@/components/govuk/PageHeader";
import { listRequesterCategories, listBankHolidays, getBankHolidayJurisdiction, listMailboxes, listEmailTemplatePurposes, listResponseTemplates } from "@/lib/services/cases";
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

  const [categories, bankHolidays, jurisdiction, mailboxes, emailTemplatePurposes, responseTemplates, users] = await Promise.all([
    listRequesterCategories().catch(() => []),
    listBankHolidays().catch(() => []),
    // Null rather than a guessed default: the filter falls back to showing
    // every country, which is honest about not knowing, where guessing
    // "england" would hide the rows that matter for a Scottish or Northern
    // Irish authority.
    getBankHolidayJurisdiction().catch(() => null),
    listMailboxes().catch(() => []),
    listEmailTemplatePurposes().catch(() => []),
    listResponseTemplates().catch(() => []),
    listUsers().catch(() => []),
  ]);

  return (
    <>
      <PageHeader title="Settings" />

      <MailboxesManager initial={mailboxes} />
      <EmailTemplatesManager initial={emailTemplatePurposes} />
      <ResponseTemplatesManager initial={responseTemplates} />
      <UsersManager initial={users} currentUserId={me.id} />
      <RequesterCategoriesManager initial={categories} />
      <BankHolidaysManager initial={bankHolidays} jurisdiction={jurisdiction} />
    </>
  );
}
