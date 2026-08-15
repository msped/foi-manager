import type { Metadata } from "next";
import Button from "@/components/ui/Button";
import CasesTable from "@/components/CasesTable";
import { listCases } from "@/lib/services/cases";
import { getMe, listUsers } from "@/lib/services/users";
import { TERMINAL_STATUSES } from "@/lib/utils";

export const metadata: Metadata = { title: "Cases — FOI Manager" };

export default async function CasesPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab = "all" } = await searchParams;
  const me = await getMe();

  const params: Record<string, string> = {};
  if (tab === "mine") {
    params.assignee = String(me.id);
    params.exclude_status = TERMINAL_STATUSES.join(",");
  } else if (tab === "review") {
    params.status = "review";
  } else if (tab === "overdue") {
    params.is_overdue = "true";
  } else if (tab === "unassigned") {
    params.unassigned = "true";
  }

  const [{ results: cases, count }, users] = await Promise.all([
    listCases(params),
    // Only the unassigned tab offers inline assignment, so skip the fetch elsewhere.
    tab === "unassigned" ? listUsers().catch(() => []) : Promise.resolve([]),
  ]);
  const foiTeam = users.filter(u => u.role === "foi_team" && u.is_active);

  return (
    <>
      <header className="staff-header">
        <div>
          <h1 className="govuk-heading-l" style={{ marginBottom: 0 }}>Cases</h1>
          <p className="govuk-body-s" style={{ color: "var(--govuk-secondary-text-colour)", marginBottom: 0 }}>
            {count} {tab === "mine" ? "open cases assigned to you" : tab === "review" ? "cases in review" : tab === "overdue" ? "overdue cases" : tab === "unassigned" ? "open cases awaiting assignment" : "total"}
          </p>
        </div>
        <div className="staff-header-actions">
          <Button variant="secondary">Export CSV</Button>
          <Button href="/cases/new">New case</Button>
        </div>
      </header>

      <div className="staff-body">
        <CasesTable cases={cases} activeTab={tab} foiTeam={foiTeam} />
      </div>
    </>
  );
}
