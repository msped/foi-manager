import { notFound } from "next/navigation";
import PageHeader from "@/components/govuk/PageHeader";
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
    <>
      <PageHeader
        title={consultation.case_ref}
        caption="Consultation"
        breadcrumbs={[
          { href: "/consultations", text: "My consultations" },
          { text: consultation.case_ref },
        ]}
        actions={
          <Tag colour={STATUS_COLOUR[consultation.status]}>
            {STATUS_LABEL[consultation.status]}
          </Tag>
        }
      />

      <div className="govuk-grid-row">
        <div className="govuk-grid-column-two-thirds">
          <h2 className="govuk-heading-s">What you need to respond to</h2>
          <p className="govuk-body" style={{ whiteSpace: "pre-wrap" }}>
            {consultation.scope}
          </p>

          <AssigneeConsultationDetail consultation={consultation} />
        </div>
      </div>
    </>
  );
}
