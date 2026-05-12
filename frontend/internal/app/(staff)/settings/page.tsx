import type { Metadata } from "next";
import { listRequesterCategories, listBankHolidays } from "@/lib/services/cases";
import RequesterCategoriesManager from "./RequesterCategoriesManager";
import BankHolidaysManager from "./BankHolidaysManager";

export const metadata: Metadata = { title: "Settings — FOI Manager" };

export default async function SettingsPage() {
  const [categories, bankHolidays] = await Promise.all([
    listRequesterCategories().catch(() => []),
    listBankHolidays().catch(() => []),
  ]);

  return (
    <>
      <header className="staff-header">
        <h1 className="govuk-heading-l" style={{ marginBottom: 0 }}>Settings</h1>
      </header>

      <div className="staff-body">
        <div style={{ maxWidth: 800 }}>
          <RequesterCategoriesManager initial={categories} />
          <BankHolidaysManager initial={bankHolidays} />
        </div>
      </div>
    </>
  );
}
