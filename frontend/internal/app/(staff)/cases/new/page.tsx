import type { Metadata } from "next";
import PageHeader from "@/components/govuk/PageHeader";
import { listRequesterCategories } from "@/lib/services/cases";
import NewCaseForm from "./NewCaseForm";

export const metadata: Metadata = { title: "New case — FOI Manager" };

export default async function NewCasePage() {
  const requesterCategories = await listRequesterCategories().catch(() => []);

  return (
    <>
      <PageHeader
        title="New case"
        breadcrumbs={[
          { href: "/cases", text: "Cases" },
          { text: "New case" },
        ]}
      />
      <div className="govuk-grid-row">
        <div className="govuk-grid-column-two-thirds">
          <NewCaseForm requesterCategories={requesterCategories} />
        </div>
      </div>
    </>
  );
}
