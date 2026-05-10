import type { Metadata } from "next";
import Link from "next/link";
import { listDepartments, listRequesterCategories } from "@/lib/services/cases";
import NewCaseForm from "./NewCaseForm";

export const metadata: Metadata = { title: "New case — FOI Manager" };

export default async function NewCasePage() {
  const [departments, requesterCategories] = await Promise.all([
    listDepartments().catch(() => []),
    listRequesterCategories().catch(() => []),
  ]);

  return (
    <>
      <header className="staff-header">
        <div>
          <div className="staff-header-crumbs">
            <Link href="/cases" className="govuk-link">Cases</Link>
          </div>
          <h1 className="govuk-heading-l" style={{ marginBottom: 0 }}>New case</h1>
        </div>
      </header>

      <div className="staff-body">
        <div style={{ maxWidth: 640 }}>
          <NewCaseForm departments={departments} requesterCategories={requesterCategories} />
        </div>
      </div>
    </>
  );
}
