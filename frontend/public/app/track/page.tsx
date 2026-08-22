import type { Metadata } from "next";
import Breadcrumbs from "@/components/govuk/Breadcrumbs";
import TrackForm from "./TrackForm";

export const metadata: Metadata = {
  title: "Check a request",
  description:
    "Check the progress of a Freedom of Information request you have made.",
  // Nothing under /track should be indexed. The pages are personal to whoever
  // has verified, and a search engine has no business holding a cached copy.
  robots: { index: false, follow: false },
};

export default function TrackPage() {
  return (
    <>
      <Breadcrumbs
        items={[{ href: "/", text: "Home" }, { text: "Check a request" }]}
      />

      <div className="govuk-grid-row">
        <div className="govuk-grid-column-two-thirds">
          <TrackForm />
        </div>
      </div>
    </>
  );
}
