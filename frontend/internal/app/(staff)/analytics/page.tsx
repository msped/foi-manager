import type { Metadata } from "next";
import Button from "@/components/ui/Button";

export const metadata: Metadata = { title: "Analytics — FOI Manager" };

const STATS = [
  { label: "Requests received",         value: "675",    delta: "+8% YoY",  up: true  },
  { label: "Average response time",     value: "16 days",delta: "−2 days",  up: true  },
  { label: "Within statutory limit",    value: "94%",    delta: "+2pp",     up: true  },
  { label: "Refusals upheld at review", value: "82%",    delta: "−4pp",     up: false },
];

const MONTHS  = ["Nov", "Dec", "Jan", "Feb", "Mar", "Apr"];
const RECEIVED= [98, 84, 112, 124, 138, 119];
const CLOSED  = [102, 90, 109, 118, 130, 121];
const MAX = Math.max(...RECEIVED, ...CLOSED);

const OUTCOMES = [
  { label: "Disclosed in full",    pct: 58, colour: "var(--govuk-success-colour, #00703c)" },
  { label: "Disclosed in part",    pct: 22, colour: "#1d70b8" },
  { label: "Information not held", pct:  9, colour: "#505a5f" },
  { label: "Refused (exemptions)", pct:  8, colour: "#f47738" },
  { label: "Cost limit (s.12)",    pct:  3, colour: "var(--govuk-error-colour, #d4351c)" },
];

const BY_DEPT = [
  { d: "Planning",             cases: 184, ontime: 96 },
  { d: "Adult Social Care",    cases: 142, ontime: 91 },
  { d: "Children's Services",  cases: 121, ontime: 88 },
  { d: "Highways & Transport", cases: 108, ontime: 97 },
  { d: "Finance",              cases:  88, ontime: 99 },
  { d: "Housing",              cases:  74, ontime: 92 },
];

export default function AnalyticsPage() {
  return (
    <>
      <header className="staff-header">
        <h1 className="govuk-heading-l">Analytics</h1>
        <div className="staff-header-actions">
          <select className="govuk-select" defaultValue="6m" aria-label="Date range" style={{ width: "auto" }}>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="6m">Last 6 months</option>
            <option value="ytd">Year to date</option>
          </select>
          <Button variant="secondary">Export PDF</Button>
        </div>
      </header>

      <div className="staff-body">
        <div className="foi-grid-4" style={{ marginBottom: 24 }}>
          {STATS.map(s => (
            <div key={s.label} className="foi-stat">
              <div className="foi-stat-label">{s.label}</div>
              <div className="foi-stat-value">{s.value}</div>
              <div className={`foi-stat-delta${s.up ? " foi-stat-delta-up" : " foi-stat-delta-down"}`}>
                {s.delta}
              </div>
            </div>
          ))}
        </div>

        <div className="foi-grid-2" style={{ marginBottom: 24 }}>
          <div className="foi-card">
            <h2 className="govuk-heading-s">Volume — received vs. closed</h2>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 20, height: 180, padding: "0 0 28px" }}>
              {MONTHS.map((m, i) => (
                <div key={m} style={{ flex: 1, display: "flex", gap: 3, alignItems: "flex-end", position: "relative", height: "100%" }}>
                  <div style={{ flex: 1, background: "#0b0c0c", height: `${(RECEIVED[i] / MAX) * 100}%`, minHeight: 3 }} />
                  <div style={{ flex: 1, background: "#1d70b8", height: `${(CLOSED[i] / MAX) * 100}%`, minHeight: 3, opacity: 0.85 }} />
                  <div style={{ position: "absolute", bottom: -22, left: 0, right: 0, textAlign: "center", fontSize: 11, color: "var(--govuk-secondary-text-colour)" }}>
                    {m}
                  </div>
                </div>
              ))}
            </div>
            <div className="foi-row" style={{ gap: 16, marginTop: 8 }}>
              <span className="foi-row govuk-body-s" style={{ gap: 6, marginBottom: 0 }}>
                <span style={{ width: 12, height: 12, background: "#0b0c0c", display: "inline-block" }} /> Received
              </span>
              <span className="foi-row govuk-body-s" style={{ gap: 6, marginBottom: 0 }}>
                <span style={{ width: 12, height: 12, background: "#1d70b8", display: "inline-block" }} /> Closed
              </span>
            </div>
          </div>

          <div className="foi-card">
            <h2 className="govuk-heading-s">Outcomes</h2>
            <ul className="govuk-list" style={{ margin: 0 }}>
              {OUTCOMES.map(({ label, pct, colour }) => (
                <li key={label} style={{ padding: "8px 0" }}>
                  <div className="foi-spread govuk-body-s" style={{ marginBottom: 4 }}>
                    <span>{label}</span>
                    <strong style={{ fontVariantNumeric: "tabular-nums" }}>{pct}%</strong>
                  </div>
                  <div style={{ height: 6, background: "var(--govuk-template-background-colour)", overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: colour }} />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="foi-card" style={{ padding: 0 }}>
          <div style={{ padding: "16px 20px 12px" }}>
            <h2 className="govuk-heading-s" style={{ marginBottom: 0 }}>By department</h2>
          </div>
          <table className="govuk-table" style={{ marginBottom: 0 }}>
            <thead className="govuk-table__head">
              <tr className="govuk-table__row">
                <th className="govuk-table__header">Department</th>
                <th className="govuk-table__header" style={{ width: 120 }}>Cases (12m)</th>
                <th className="govuk-table__header" style={{ width: 240 }}>On-time rate</th>
                <th className="govuk-table__header" style={{ width: 120 }}>Avg. days</th>
              </tr>
            </thead>
            <tbody className="govuk-table__body">
              {BY_DEPT.map(d => (
                <tr key={d.d} className="govuk-table__row">
                  <td className="govuk-table__cell" style={{ fontWeight: 600 }}>{d.d}</td>
                  <td className="govuk-table__cell" style={{ fontVariantNumeric: "tabular-nums" }}>{d.cases}</td>
                  <td className="govuk-table__cell">
                    <div className="foi-row" style={{ gap: 8 }}>
                      <div style={{ flex: 1, height: 6, background: "var(--govuk-template-background-colour)", overflow: "hidden" }}>
                        <div style={{
                          width: `${d.ontime}%`,
                          height: "100%",
                          background: d.ontime >= 95 ? "var(--govuk-success-colour, #00703c)" : d.ontime >= 90 ? "#1d70b8" : "#f47738",
                        }} />
                      </div>
                      <span style={{ minWidth: 36, fontVariantNumeric: "tabular-nums", fontSize: 13 }}>{d.ontime}%</span>
                    </div>
                  </td>
                  <td className="govuk-table__cell" style={{ fontVariantNumeric: "tabular-nums" }}>
                    {14 + (d.cases % 6)} days
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
