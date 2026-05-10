import type { Metadata } from "next";
import { listRequesterCategories } from "@/lib/services/cases";
import RequesterCategoriesManager from "./RequesterCategoriesManager";

export const metadata: Metadata = { title: "Settings — FOI Manager" };

export default async function SettingsPage() {
  const categories = await listRequesterCategories().catch(() => []);

  return (
    <>
      <header className="staff-header">
        <h1 className="govuk-heading-l" style={{ marginBottom: 0 }}>Settings</h1>
      </header>

      <div className="staff-body">
        <div style={{ maxWidth: 640 }}>
          <RequesterCategoriesManager initial={categories} />
        </div>
      </div>
    </>
  );
}
