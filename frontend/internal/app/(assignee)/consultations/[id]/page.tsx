import { notFound } from "next/navigation";
import { getMyConsultation } from "@/lib/services/cases";
import { Tag } from "@/components/ui/Tag";
import type { ConsultationStatus } from "@/lib/types";
import AssigneeConsultationDetail from "./AssigneeConsultationDetail";

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

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AssigneeConsultationPage({ params }: Props) {
  const { id } = await params;
  let consultation;
  try {
    consultation = await getMyConsultation(id);
  } catch {
    notFound();
  }

  return (
    <div className="staff-body">
      <div className="staff-header">
        <div>
          <p className="govuk-body-s" style={{ color: "var(--govuk-secondary-text-colour)", marginBottom: 4 }}>
            Consultation
          </p>
          <h1 className="govuk-heading-l" style={{ marginBottom: 0 }}>{consultation.case_ref}</h1>
        </div>
        <Tag colour={STATUS_COLOUR[consultation.status]}>{STATUS_LABEL[consultation.status]}</Tag>
      </div>

      <div className="foi-col" style={{ maxWidth: 960 }}>
        <div className="foi-card">
          <h2 className="govuk-heading-s">What you need to respond to</h2>
          <p className="govuk-body-s" style={{ whiteSpace: "pre-wrap", marginBottom: 0 }}>
            {consultation.scope}
          </p>
        </div>

        <AssigneeConsultationDetail consultation={consultation} />
      </div>
    </div>
  );
}
