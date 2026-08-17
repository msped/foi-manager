import type { Metadata } from "next";
import Link from "next/link";
import Button from "@/components/ui/Button";
import PageHeader from "@/components/govuk/PageHeader";
import { StatusTag } from "@/components/ui/Tag";
import AiPanel from "@/components/ui/AiPanel";
import { getMe } from "@/lib/services/users";
import { listCases } from "@/lib/services/cases";
import { fmtDate, daysUntil, isTerminalStatus, TERMINAL_STATUSES } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard — FOI Manager" };

export default async function DashboardPage() {
  const [user, { results: cases, count: totalCount }, { count: openCount }] = await Promise.all([
    getMe(),
    listCases(),
    listCases({ exclude_status: TERMINAL_STATUSES.join(",") }),
  ]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const overdue    = cases.filter(c => c.is_overdue);
  const inReview   = cases.filter(c => c.status === "review");
  const dueThisWeek = cases.filter(c => {
    if (isTerminalStatus(c.status)) return false;
    const d = daysUntil(c.statutory_deadline);
    return d !== null && d >= 0 && d <= 7;
  });

  const STATS = [
    { label: "Open cases",       value: String(openCount),      delta: "active FOI requests",               dir: "neutral" },
    { label: "Due this week",    value: String(dueThisWeek.length), delta: "statutory deadline", dir: dueThisWeek.length > 5 ? "down" : "neutral" },
    { label: "Awaiting review",  value: String(inReview.length),   delta: "cases in review",   dir: "neutral" },
    { label: "Overdue",          value: String(overdue.length),    delta: overdue.length === 0 ? "none — on track" : "need attention", dir: overdue.length > 0 ? "down" : "up" },
  ];

  const upcoming = cases
    .filter(c => c.statutory_deadline && !isTerminalStatus(c.status))
    .sort((a, b) => new Date(a.statutory_deadline!).getTime() - new Date(b.statutory_deadline!).getTime())
    .slice(0, 5);

  return (
    <>
      <PageHeader
        title={`${greeting}, ${user.first_name}`}
        actions={<Button href="/cases/new">New case</Button>}
      />

      <div className="govuk-grid-row govuk-!-margin-bottom-6">
        {STATS.map((s) => (
          <div key={s.label} className="govuk-grid-column-one-quarter">
            <div className="foi-stat">
              <div className="foi-stat__label">{s.label}</div>
              <div className="foi-stat__value">{s.value}</div>
              <div className={`foi-stat__delta${s.dir === "up" ? " foi-stat__delta--up" : s.dir === "down" ? " foi-stat__delta--down" : ""}`}>
                {s.delta}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="govuk-grid-row">
        <div className="govuk-grid-column-two-thirds">
          <div className="foi-spread govuk-!-margin-bottom-3">
            <h2 className="govuk-heading-m govuk-!-margin-bottom-0">Recent cases</h2>
            <Link href="/cases" className="govuk-link">View all {totalCount}</Link>
          </div>

          <table className="govuk-table">
            <thead className="govuk-table__head">
              <tr className="govuk-table__row">
                <th scope="col" className="govuk-table__header">Reference</th>
                <th scope="col" className="govuk-table__header">Summary</th>
                <th scope="col" className="govuk-table__header">Status</th>
                <th scope="col" className="govuk-table__header">Due</th>
              </tr>
            </thead>
            <tbody className="govuk-table__body">
              {cases.slice(0, 6).map((c) => {
                const days = isTerminalStatus(c.status) ? null : daysUntil(c.statutory_deadline);
                return (
                  <tr key={c.id} className="govuk-table__row">
                    <td className="govuk-table__cell">
                      <Link href={`/cases/${c.id}`} className="govuk-link foi-mono">
                        {c.ref}
                      </Link>
                    </td>
                    <td className="govuk-table__cell">
                      <strong>{c.summary || c.request_text.slice(0, 60) + "…"}</strong>
                      <br />
                      <span className="govuk-hint govuk-!-margin-bottom-0">{c.requester_name}</span>
                    </td>
                    <td className="govuk-table__cell">
                      <StatusTag status={c.status} />
                    </td>
                    <td className="govuk-table__cell">
                      {days !== null ? (
                        <>
                          {days < 0 ? (
                            <strong className="govuk-error-message govuk-!-margin-bottom-0">{-days} days overdue</strong>
                          ) : days <= 3 ? (
                            <strong>{days} days left</strong>
                          ) : (
                            `${days} days`
                          )}
                          <br />
                          <span className="govuk-hint govuk-!-margin-bottom-0">
                            {fmtDate(c.statutory_deadline)}
                          </span>
                        </>
                      ) : "—"}
                    </td>
                  </tr>
                );
              })}
              {cases.length === 0 && (
                <tr className="govuk-table__row">
                  <td className="govuk-table__cell" colSpan={4}>No cases yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="govuk-grid-column-one-third">
          <AiPanel title="Today's briefing" micro="AI summary">
            <p className="govuk-body">
              {overdue.length > 0
                ? <><strong>{overdue.length} {overdue.length === 1 ? "case is" : "cases are"} overdue</strong> — action needed.</>
                : <><strong>No overdue cases</strong> — on track.</>
              }
            </p>
            {dueThisWeek.length > 0 && (
              <ul className="govuk-list govuk-list--bullet">
                {dueThisWeek.slice(0, 3).map(c => (
                  <li key={c.id}>
                    <Link href={`/cases/${c.id}`} className="govuk-link">{c.ref}</Link>
                    {" — "}{c.summary.slice(0, 50) || "no summary"} ({daysUntil(c.statutory_deadline)} days left)
                  </li>
                ))}
              </ul>
            )}
            <p className="govuk-hint govuk-!-margin-bottom-0">
              AI exemption suggestions and precedent search are available on each case.
            </p>
          </AiPanel>

          <h2 className="govuk-heading-s govuk-!-margin-top-6">Upcoming deadlines</h2>
          {upcoming.length === 0 ? (
            <p className="govuk-hint">No upcoming deadlines.</p>
          ) : (
            <dl className="govuk-summary-list govuk-summary-list--no-border">
              {upcoming.map(c => {
                const d = daysUntil(c.statutory_deadline);
                return (
                  <div key={c.id} className="govuk-summary-list__row">
                    <dt className="govuk-summary-list__key">
                      <Link href={`/cases/${c.id}`} className="govuk-link foi-mono">{c.ref}</Link>
                    </dt>
                    <dd className="govuk-summary-list__value">
                      {d !== null && d <= 5 ? (
                        <strong className="govuk-error-message govuk-!-margin-bottom-0">
                          {fmtDate(c.statutory_deadline)}
                        </strong>
                      ) : (
                        fmtDate(c.statutory_deadline)
                      )}
                    </dd>
                  </div>
                );
              })}
            </dl>
          )}
        </div>
      </div>
    </>
  );
}
