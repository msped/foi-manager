import Link from "next/link";
import PageHeader from "@/components/govuk/PageHeader";
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
    <>
      <PageHeader title="My consultations" />

      {consultations.length === 0 ? (
        <p className="govuk-body">You have no active consultations assigned to you.</p>
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
                  <span className="foi-mono">{c.case_ref}</span>
                </td>
                <td className="govuk-table__cell">{truncate(c.scope, 120)}</td>
                <td className="govuk-table__cell">
                  <Tag colour={STATUS_COLOUR[c.status]}>{STATUS_LABEL[c.status]}</Tag>
                </td>
                <td className="govuk-table__cell">{fmtDate(c.created_at)}</td>
                <td className="govuk-table__cell">
                  <Link href={`/consultations/${c.id}`} className="govuk-link">
                    View<span className="govuk-visually-hidden"> consultation {c.case_ref}</span>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
