"use client";

import { useState } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import { Tag } from "@/components/ui/Tag";
import Avatar from "@/components/ui/Avatar";
import { fmtDate } from "@/lib/utils";

const QUEUE = [
  { ref: "FOI-2026-0418", title: "Pothole repair spending by ward 2023–2025",     author: "MB", reviewer: "AK", redactions: 4,  approved: false },
  { ref: "FOI-2026-0407", title: "Council tax arrears: enforcement contracts",     author: "OA", reviewer: "AK", redactions: 12, approved: false },
  { ref: "FOI-2026-0388", title: "RIPA authorisations 2024–2025",                 author: "HV", reviewer: "AK", redactions: 0,  approved: true  },
];

const CHECKLIST = [
  { text: "All requested information is included or accounted for",           ok: true  },
  { text: "Personal data has been redacted (s.40)",                           ok: true  },
  { text: "Response letter applies the public interest test where needed",    ok: true  },
  { text: "Attachments open without errors",                                  ok: true  },
  { text: "No internal-only metadata in attached files",                      ok: false },
];

export default function PublishPage() {
  const [picked, setPicked] = useState(QUEUE[0].ref);
  const item = QUEUE.find(q => q.ref === picked) ?? QUEUE[0];

  return (
    <>
      <header className="staff-header">
        <h1 className="govuk-heading-l">Ready to publish</h1>
        <div className="staff-header-actions">
          <Button variant="secondary">Settings</Button>
        </div>
      </header>

      <div className="staff-body">
        <div className="foi-grid-sidebar" style={{ gridTemplateColumns: "300px 1fr" }}>
          <div>
            <p className="govuk-body-s" style={{ color: "var(--govuk-secondary-text-colour)", marginBottom: 8 }}>
              {QUEUE.length} in queue
            </p>
            <div className="foi-col" style={{ gap: 8 }}>
              {QUEUE.map(q => (
                <button
                  key={q.ref}
                  onClick={() => setPicked(q.ref)}
                  style={{
                    textAlign: "left",
                    padding: 14,
                    border: q.ref === picked ? "2px solid #0b0c0c" : "1px solid var(--govuk-border-colour)",
                    background: q.ref === picked ? "#fff" : "#f9f9f9",
                    cursor: "pointer",
                    font: "inherit",
                    color: "inherit",
                    width: "100%",
                  }}
                >
                  <div className="foi-row" style={{ gap: 6, marginBottom: 6 }}>
                    <span className="foi-mono" style={{ fontSize: 11, color: "var(--govuk-secondary-text-colour)" }}>{q.ref}</span>
                    <Tag colour={q.approved ? "green" : "yellow"}>{q.approved ? "Approved" : "Review"}</Tag>
                  </div>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{q.title}</div>
                  <div className="govuk-body-s" style={{ color: "var(--govuk-secondary-text-colour)", marginBottom: 0 }}>
                    {q.redactions} redactions
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="foi-col">
            <div className="foi-card">
              <div className="foi-spread" style={{ marginBottom: 12 }}>
                <div>
                  <span className="foi-mono govuk-body-s" style={{ color: "var(--govuk-secondary-text-colour)" }}>{item.ref}</span>
                  <h2 className="govuk-heading-m" style={{ marginTop: 4 }}>{item.title}</h2>
                </div>
                <div className="foi-row">
                  <Button variant="secondary" size="small">Request changes</Button>
                  <Button variant="warning" size="small">Reject</Button>
                  <Button size="small">Approve & send</Button>
                </div>
              </div>
              <dl className="govuk-summary-list govuk-summary-list--no-border">
                <div className="govuk-summary-list__row">
                  <dt className="govuk-summary-list__key">Drafted by</dt>
                  <dd className="govuk-summary-list__value">
                    <Avatar initials={item.author} size="xs" /> Marcus Bell — Highways & Transport
                  </dd>
                </div>
                <div className="govuk-summary-list__row">
                  <dt className="govuk-summary-list__key">Reviewer</dt>
                  <dd className="govuk-summary-list__value">
                    <Avatar initials={item.reviewer} size="xs" /> Aisha Khan (you)
                  </dd>
                </div>
                <div className="govuk-summary-list__row">
                  <dt className="govuk-summary-list__key">Outcome</dt>
                  <dd className="govuk-summary-list__value"><Tag colour="yellow">Partial — s.40 applied</Tag></dd>
                </div>
                <div className="govuk-summary-list__row">
                  <dt className="govuk-summary-list__key">Redactions</dt>
                  <dd className="govuk-summary-list__value">{item.redactions} applied · 0 outstanding suggestions</dd>
                </div>
              </dl>
            </div>

            <div className="foi-card">
              <h3 className="govuk-heading-s">Review checklist</h3>
              <ul className="govuk-list" style={{ fontSize: 14 }}>
                {CHECKLIST.map((t, i) => (
                  <li key={i} style={{
                    padding: "8px 0",
                    borderBottom: "1px solid var(--govuk-border-colour)",
                    display: "flex",
                    gap: 10,
                    alignItems: "center",
                  }}>
                    <input type="checkbox" defaultChecked={t.ok} className="govuk-checkboxes__input" style={{ width: 18, height: 18, margin: 0 }} />
                    <span style={{ flex: 1 }}>{t.text}</span>
                    {!t.ok && <Tag colour="yellow">Verify</Tag>}
                  </li>
                ))}
              </ul>
            </div>

            <div className="foi-card">
              <h3 className="govuk-heading-s">Final response preview</h3>
              <div
                style={{
                  background: "var(--govuk-template-background-colour)",
                  border: "1px solid var(--govuk-border-colour)",
                  padding: 18,
                  fontFamily: "Georgia, serif",
                  fontSize: 14,
                  lineHeight: 1.65,
                }}
              >
                <p style={{ marginTop: 0 }}>Dear Applicant,</p>
                <p>Thank you for your request regarding <em>{item.title.toLowerCase()}</em>.</p>
                <p>We can confirm the council holds this information. Please find the data attached as Annex A. A small number of values have been withheld under <strong>section 40</strong> of the Freedom of Information Act 2000.</p>
                <p>If you are unhappy with this response you may ask for an internal review within 40 working days.</p>
                <p style={{ marginBottom: 0 }}>Yours sincerely,<br />Information Governance</p>
              </div>
              <p className="govuk-body-s" style={{ color: "var(--govuk-secondary-text-colour)", marginTop: 10 }}>
                On approval, the letter and attachments will be emailed to the applicant and published to the disclosure log within 1 working day.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
