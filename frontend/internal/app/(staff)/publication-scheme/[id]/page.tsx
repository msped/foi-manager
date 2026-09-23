import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import PageHeader from "@/components/govuk/PageHeader";
import { getSchemeEntry } from "@/lib/services/publications";
import { getMe } from "@/lib/services/users";
import PublishControls from "../PublishControls";
import SchemeEntryForm from "../SchemeEntryForm";
import SchemeItemsPanel from "../SchemeItemsPanel";

export const metadata: Metadata = { title: "Scheme entry — FOI Manager" };

export default async function SchemeEntryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await getMe();
  if (me.role !== "foi_team") redirect("/dashboard");

  const { id } = await params;
  const entry = await getSchemeEntry(Number(id)).catch(() => null);
  if (!entry) notFound();

  return (
    <>
      <PageHeader title={entry.title} />

      <p className="govuk-body">
        <Link href="/publication-scheme" className="govuk-link">
          Back to the publication scheme
        </Link>
      </p>

      <SchemeEntryForm entry={entry} />

      {/* Items before publishing, because publishing depends on there being
          some — an entry with nothing attached is refused. */}
      <SchemeItemsPanel entryId={entry.id} items={entry.items} />

      <PublishControls entry={entry} />
    </>
  );
}
