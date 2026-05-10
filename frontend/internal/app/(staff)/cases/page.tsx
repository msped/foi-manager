import type { Metadata } from "next";
import Button from "@/components/ui/Button";
import CasesTable from "@/components/CasesTable";
import { getMe } from "@/lib/services/users";
import { listCases } from "@/lib/services/cases";

export const metadata: Metadata = { title: "Cases — FOI Manager" };

export default async function CasesPage() {
  const [user, { results: cases, count }] = await Promise.all([
    getMe(),
    listCases(),
  ]);

  const currentUserName = `${user.first_name} ${user.last_name}`;

  return (
    <>
      <header className="staff-header">
        <div>
          <h1 className="govuk-heading-l" style={{ marginBottom: 0 }}>Cases</h1>
          <p className="govuk-body-s" style={{ color: "var(--govuk-secondary-text-colour)", marginBottom: 0 }}>
            {count} total · showing first page
          </p>
        </div>
        <div className="staff-header-actions">
          <Button variant="secondary">Export CSV</Button>
          <Button href="/cases/new">New case</Button>
        </div>
      </header>

      <div className="staff-body">
        <CasesTable cases={cases} currentUserName={currentUserName} />
      </div>
    </>
  );
}
