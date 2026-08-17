import type { Metadata } from "next";
import type { CSSProperties } from "react";
import Button from "@/components/ui/Button";
import PageHeader from "@/components/govuk/PageHeader";

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
  { label: "Disclosed in full",    pct: 58, variant: "good"  },
  { label: "Disclosed in part",    pct: 22, variant: ""      },
  { label: "Information not held", pct:  9, variant: "muted" },
  { label: "Refused (exemptions)", pct:  8, variant: "warn"  },
  { label: "Cost limit (s.12)",    pct:  3, variant: "bad"   },
] as const;

const BY_DEPT = [
  { d: "Planning",             cases: 184, ontime: 96 },
  { d: "Adult Social Care",    cases: 142, ontime: 91 },
  { d: "Children's Services",  cases: 121, ontime: 88 },
  { d: "Highways & Transport", cases: 108, ontime: 97 },
  { d: "Finance",              cases:  88, ontime: 99 },
  { d: "Housing",              cases:  74, ontime: 92 },
];

/** Bar and meter widths are passed to CSS as a custom property. */
function value(pct: number): CSSProperties {
  return { "--foi-value": `${pct}%` } as CSSProperties;
}

export default function AnalyticsPage() {
  return (
    <>
      <PageHeader
        title="Analytics"
        actions={
          <>
            <label className="govuk-visually-hidden" htmlFor="date-range">Date range</label>
            <select className="govuk-select" id="date-range" defaultValue="6m">
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="6m">Last 6 months</option>
              <option value="ytd">Year to date</option>
            </select>
            <Button variant="secondary">Export PDF</Button>
          </>
        }
      />

      <div className="govuk-grid-row govuk-!-margin-bottom-6">
        {STATS.map(s => (
          <div key={s.label} className="govuk-grid-column-one-quarter">
            <div className="foi-stat">
              <div className="foi-stat__label">{s.label}</div>
              <div className="foi-stat__value">{s.value}</div>
              <div className={`foi-stat__delta foi-stat__delta--${s.up ? "up" : "down"}`}>
                {s.delta}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="govuk-grid-row govuk-!-margin-bottom-6">
        <div className="govuk-grid-column-one-half">
          <h2 className="govuk-heading-s">Volume — received vs. closed</h2>
          <div className="foi-bar-chart">
            {MONTHS.map((m, i) => (
              <div key={m} className="foi-bar-chart__col">
                <div className="foi-bar-chart__bar" style={value((RECEIVED[i] / MAX) * 100)} />
                <div
                  className="foi-bar-chart__bar foi-bar-chart__bar--secondary"
                  style={value((CLOSED[i] / MAX) * 100)}
                />
                <div className="foi-bar-chart__label">{m}</div>
              </div>
            ))}
          </div>
          <div className="foi-legend">
            <span className="foi-legend__item">
              <span className="foi-legend__swatch" aria-hidden="true" /> Received
            </span>
            <span className="foi-legend__item">
              <span className="foi-legend__swatch foi-legend__swatch--secondary" aria-hidden="true" /> Closed
            </span>
          </div>
        </div>

        <div className="govuk-grid-column-one-half">
          <h2 className="govuk-heading-s">Outcomes</h2>
          <ul className="govuk-list">
            {OUTCOMES.map(({ label, pct, variant }) => (
              <li key={label}>
                <div className="foi-spread govuk-!-margin-bottom-1">
                  <span>{label}</span>
                  <strong className="foi-numeric">{pct}%</strong>
                </div>
                <div className="foi-meter">
                  <div
                    className={`foi-meter__fill${variant ? ` foi-meter__fill--${variant}` : ""}`}
                    style={value(pct)}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <h2 className="govuk-heading-s">By department</h2>
      <table className="govuk-table">
        <thead className="govuk-table__head">
          <tr className="govuk-table__row">
            <th scope="col" className="govuk-table__header">Department</th>
            <th scope="col" className="govuk-table__header">Cases (12m)</th>
            <th scope="col" className="govuk-table__header govuk-!-width-one-third">On-time rate</th>
            <th scope="col" className="govuk-table__header">Avg. days</th>
          </tr>
        </thead>
        <tbody className="govuk-table__body">
          {BY_DEPT.map(d => (
            <tr key={d.d} className="govuk-table__row">
              <td className="govuk-table__cell"><strong>{d.d}</strong></td>
              <td className="govuk-table__cell foi-numeric">{d.cases}</td>
              <td className="govuk-table__cell">
                <div className="foi-row">
                  <div className="foi-meter" style={{ flex: 1 }}>
                    <div
                      className={`foi-meter__fill foi-meter__fill--${
                        d.ontime >= 95 ? "good" : d.ontime >= 90 ? "" : "warn"
                      }`}
                      style={value(d.ontime)}
                    />
                  </div>
                  <span className="foi-numeric">{d.ontime}%</span>
                </div>
              </td>
              <td className="govuk-table__cell foi-numeric">{14 + (d.cases % 6)} days</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
