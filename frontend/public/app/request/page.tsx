import type { Metadata } from "next";
import Breadcrumbs from "@/components/govuk/Breadcrumbs";
import RequestForm from "./RequestForm";

export const metadata: Metadata = {
  title: "Make a request",
  description:
    "Ask for recorded information under the Freedom of Information Act 2000.",
};

export default function RequestPage() {
  return (
    <>
      <Breadcrumbs items={[{ href: "/", text: "Home" }, { text: "Make a request" }]} />

      <div className="govuk-grid-row">
        <div className="govuk-grid-column-two-thirds">
          <RequestForm />
        </div>
      </div>
    </>
  );
}
