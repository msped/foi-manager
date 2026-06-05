import Link from "next/link";
import { listMyConsultations } from "@/lib/services/cases";
import { Tag } from "@/components/ui/Tag";
import { fmtDate } from "@/lib/utils";
import type { ConsultationStatus } from "@/lib/types";

const STATUS_COLOUR: Record<ConsultationStatus, "yellow" | "green" | "grey"> = {
  open: "yellow",
  closed: "green",
  withdrawn: "grey",
};

const STATUS_LABEL: Record<ConsultationStatus, string> = {
  open: "Open",
  closed: "Closed",
  withdrawn: "Withdrawn",
};

function truncate(text: string, max: number) {
  return text.length > max ? text.slice(0, max) + "…" : text;
}

export default async function AssigneeConsultationsPage() {
  const consultations = await listMyConsultations();

  return (
    <div className="staff-body">
      <div className="staff-header">
        <h1 className="govuk-heading-l" style={{ marginBottom: 0 }}>My Consultations</h1>
      </div>

      {consultations.length === 0 ? (
        <div className="foi-card">
          <p className="govuk-body" style={{ color: "var(--govuk-secondary-text-colour)", marginBottom: 0 }}>
            You have no active consultations assigned to you.
          </p>
        </div>
      ) : (
        <table className="govuk-table">
          <thead className="govuk-table__head">
            <tr className="govuk-table__row">
              <th className="govuk-table__header">Reference</th>
              <th className="govuk-table__header">Scope</th>
              <th className="govuk-table__header">Status</th>
              <th className="govuk-table__header">Received</th>
              <th className="govuk-table__header"></th>
            </tr>
          </thead>
          <tbody className="govuk-table__body">
            {consultations.map((c) => (
              <tr key={c.id} className="govuk-table__row">
                <td className="govuk-table__cell">
                  <span style={{ fontWeight: 600, fontFamily: "monospace", fontSize: 13 }}>{c.case_ref}</span>
                </td>
                <td className="govuk-table__cell govuk-body-s">
                  {truncate(c.scope, 120)}
                </td>
                <td className="govuk-table__cell">
                  <Tag colour={STATUS_COLOUR[c.status]}>{STATUS_LABEL[c.status]}</Tag>
                </td>
                <td className="govuk-table__cell govuk-body-s">
                  {fmtDate(c.created_at)}
                </td>
                <td className="govuk-table__cell">
                  <Link href={`/consultations/${c.id}`} className="govuk-link govuk-body-s">
                    View →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
