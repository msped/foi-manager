import type { Metadata } from "next";
import Link from "next/link";
import Button from "@/components/ui/Button";
import PageHeader from "@/components/govuk/PageHeader";
import { StatusTag } from "@/components/ui/Tag";
import AiPanel from "@/components/ui/AiPanel";
import { getMe } from "@/lib/services/users";
import { getCaseStats, listCases } from "@/lib/services/cases";
import { fmtDate, daysUntil, isTerminalStatus } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard — FOI Manager" };

export default async function DashboardPage() {
  const user = await getMe();

  // Everything on this page is the signed-in user's own work. The
  // service-wide view lives on /cases, where each figure is a tab you can
  // click into; repeating it here would put two scopes on one screen with
  // nothing marking the boundary.
  const mine = { assignee: String(user.id) };

  // Counted server-side. Filtering `cases` below would only ever see the first
  // page of results, so every figure would stop climbing at the page size.
  const [stats, { results: cases }] = await Promise.all([
    getCaseStats(mine),
    listCases(mine),
  ]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const STATS = [
    { label: "My open cases",  value: String(stats.open),      delta: "assigned to you",       dir: "neutral" },
    { label: "Due soon",       value: String(stats.due_soon),  delta: "within 5 working days", dir: stats.due_soon > 5 ? "down" : "neutral" },
    { label: "Awaiting review", value: String(stats.in_review), delta: "cases in review",       dir: "neutral" },
    { label: "Overdue",        value: String(stats.overdue),   delta: stats.overdue === 0 ? "none — on track" : "need attention", dir: stats.overdue > 0 ? "down" : "up" },
  ];

  const upcoming = cases
    .filter(c => c.statutory_deadline && !isTerminalStatus(c.status) && !c.clock_paused)
    .sort((a, b) => new Date(a.statutory_deadline!).getTime() - new Date(b.statutory_deadline!).getTime())
    .slice(0, 5);

  // The briefing names specific cases, so it needs the rows rather than the
  // counts — but it reports the server-side totals, since the rows are one page.
  const dueSoon = upcoming.filter(c => {
    const d = daysUntil(c.statutory_deadline);
    return d !== null && d >= 0;
  });

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
            <h2 className="govuk-heading-m govuk-!-margin-bottom-0">My recent cases</h2>
            <Link href="/cases" className="govuk-link">View all cases</Link>
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
                // A paused case has no clock running, so days remaining is not
                // a meaningful number for it — `resume_clock` will push the
                // deadline out by however long the pause lasted.
                const days = isTerminalStatus(c.status) || c.clock_paused
                  ? null
                  : daysUntil(c.statutory_deadline);
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
                      {c.clock_paused ? (
                        <span className="govuk-hint govuk-!-margin-bottom-0">Clock paused</span>
                      ) : days !== null ? (
                        <>
                          {c.is_overdue ? (
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
              {stats.overdue > 0
                ? <><strong>{stats.overdue} of your {stats.overdue === 1 ? "cases is" : "cases are"} overdue</strong> — action needed.</>
                : <><strong>None of your cases are overdue</strong> — on track.</>
              }
            </p>
            {dueSoon.length > 0 && (
              <ul className="govuk-list govuk-list--bullet">
                {dueSoon.slice(0, 3).map(c => (
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
