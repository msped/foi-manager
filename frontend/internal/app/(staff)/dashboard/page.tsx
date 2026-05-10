import type { Metadata } from "next";
import Link from "next/link";
import Button from "@/components/ui/Button";
import { StatusTag } from "@/components/ui/Tag";
import AiPanel from "@/components/ui/AiPanel";
import { getMe, listCases } from "@/lib/api";
import { fmtDate, daysUntil } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard — FOI Manager" };

export default async function DashboardPage() {
  const [user, { results: cases, count }] = await Promise.all([
    getMe(),
    listCases(),
  ]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const openCases  = cases.filter(c => c.status !== "published" && c.status !== "closed" && c.status !== "exempt");
  const overdue    = cases.filter(c => c.is_overdue);
  const inReview   = cases.filter(c => c.status === "review");
  const dueThisWeek = cases.filter(c => {
    const d = daysUntil(c.statutory_deadline);
    return d !== null && d >= 0 && d <= 7;
  });

  const STATS = [
    { label: "Open cases",       value: String(count),          delta: `${openCases.length} on first page`, dir: "neutral" },
    { label: "Due this week",    value: String(dueThisWeek.length), delta: "statutory deadline", dir: dueThisWeek.length > 5 ? "down" : "neutral" },
    { label: "Awaiting review",  value: String(inReview.length),   delta: "cases in review",   dir: "neutral" },
    { label: "Overdue",          value: String(overdue.length),    delta: overdue.length === 0 ? "none — on track" : "need attention", dir: overdue.length > 0 ? "down" : "up" },
  ];

  return (
    <>
      <header className="staff-header">
        <h1 className="govuk-heading-l">{greeting}, {user.first_name}</h1>
        <div className="staff-header-actions">
          <Button href="/cases/new">New case</Button>
        </div>
      </header>

      <div className="staff-body">
        <div className="foi-grid-4" style={{ marginBottom: 24 }}>
          {STATS.map((s) => (
            <div key={s.label} className="foi-stat">
              <div className="foi-stat-label">{s.label}</div>
              <div className="foi-stat-value">{s.value}</div>
              <div className={`foi-stat-delta${s.dir === "up" ? " foi-stat-delta-up" : s.dir === "down" ? " foi-stat-delta-down" : ""}`}>
                {s.delta}
              </div>
            </div>
          ))}
        </div>

        <div className="foi-grid-2">
          <div>
            <div className="foi-spread" style={{ marginBottom: 12 }}>
              <h2 className="govuk-heading-m" style={{ marginBottom: 0 }}>Recent cases</h2>
              <Link href="/cases" className="govuk-link">View all {count} →</Link>
            </div>

            <div className="foi-card" style={{ padding: 0 }}>
              <table className="govuk-table" style={{ marginBottom: 0 }}>
                <thead className="govuk-table__head">
                  <tr className="govuk-table__row">
                    <th className="govuk-table__header">Reference</th>
                    <th className="govuk-table__header">Summary</th>
                    <th className="govuk-table__header">Status</th>
                    <th className="govuk-table__header">Due</th>
                  </tr>
                </thead>
                <tbody className="govuk-table__body">
                  {cases.slice(0, 6).map((c) => {
                    const days = daysUntil(c.statutory_deadline);
                    return (
                      <tr key={c.id} className="govuk-table__row">
                        <td className="govuk-table__cell">
                          <Link href={`/cases/${c.id}`} className="govuk-link foi-mono">
                            {c.ref}
                          </Link>
                        </td>
                        <td className="govuk-table__cell">
                          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>
                            {c.summary || c.request_text.slice(0, 60) + "…"}
                          </div>
                          <div className="govuk-body-s" style={{ color: "var(--govuk-secondary-text-colour)", marginBottom: 0 }}>
                            {c.department_name ?? "No department"}
                          </div>
                        </td>
                        <td className="govuk-table__cell">
                          <StatusTag status={c.status} />
                        </td>
                        <td className="govuk-table__cell">
                          {days !== null ? (
                            <span style={{ fontSize: 13 }}>
                              {days < 0
                                ? <strong style={{ color: "var(--govuk-error-colour)" }}>{-days}d overdue</strong>
                                : days <= 3
                                  ? <strong style={{ color: "#b25800" }}>{days}d left</strong>
                                  : `${days}d`}
                              <br />
                              <span style={{ color: "var(--govuk-secondary-text-colour)", fontSize: 12 }}>
                                {fmtDate(c.statutory_deadline)}
                              </span>
                            </span>
                          ) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                  {cases.length === 0 && (
                    <tr className="govuk-table__row">
                      <td className="govuk-table__cell" colSpan={4} style={{ textAlign: "center", color: "var(--govuk-secondary-text-colour)", padding: 24 }}>
                        No cases yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <aside className="foi-col">
            <AiPanel title="Today's briefing" micro="AI summary">
              <p className="govuk-body-s">
                {overdue.length > 0
                  ? <><strong>{overdue.length} {overdue.length === 1 ? "case is" : "cases are"} overdue</strong> — action needed.</>
                  : <><strong>No overdue cases</strong> — on track.</>
                }
              </p>
              {dueThisWeek.length > 0 && (
                <ul className="govuk-list govuk-list--bullet govuk-body-s">
                  {dueThisWeek.slice(0, 3).map(c => (
                    <li key={c.id}>
                      <Link href={`/cases/${c.id}`} className="govuk-link">{c.ref}</Link>
                      {" — "}{c.summary.slice(0, 50) || "no summary"} ({daysUntil(c.statutory_deadline)}d left)
                    </li>
                  ))}
                </ul>
              )}
              <p className="govuk-body-s" style={{ color: "var(--govuk-secondary-text-colour)", marginBottom: 0 }}>
                AI exemption suggestions and precedent search are available on each case.
              </p>
            </AiPanel>

            <div className="foi-card">
              <h3 className="govuk-heading-s">Upcoming deadlines</h3>
              {cases
                .filter(c => c.statutory_deadline)
                .sort((a, b) => new Date(a.statutory_deadline!).getTime() - new Date(b.statutory_deadline!).getTime())
                .slice(0, 5)
                .map(c => {
                  const d = daysUntil(c.statutory_deadline);
                  return (
                    <div key={c.id} style={{ display: "flex", justifyContent: "space-between", paddingBottom: 8, borderBottom: "1px solid var(--govuk-border-colour)", marginBottom: 8 }}>
                      <Link href={`/cases/${c.id}`} className="govuk-link foi-mono" style={{ fontSize: 13 }}>
                        {c.ref}
                      </Link>
                      <span style={{ fontSize: 13, color: d !== null && d <= 5 ? "var(--govuk-error-colour)" : "var(--govuk-secondary-text-colour)" }}>
                        {fmtDate(c.statutory_deadline)}
                      </span>
                    </div>
                  );
                })}
              {cases.filter(c => c.statutory_deadline).length === 0 && (
                <p className="govuk-body-s" style={{ color: "var(--govuk-secondary-text-colour)" }}>No upcoming deadlines.</p>
              )}
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
