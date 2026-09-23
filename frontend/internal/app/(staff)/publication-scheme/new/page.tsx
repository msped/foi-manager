import type { Metadata } from "next";
import { redirect } from "next/navigation";
import PageHeader from "@/components/govuk/PageHeader";
import { getMe } from "@/lib/services/users";
import SchemeEntryForm from "../SchemeEntryForm";

export const metadata: Metadata = { title: "Add a scheme entry — FOI Manager" };

export default async function NewSchemeEntryPage() {
  const me = await getMe();
  if (me.role !== "foi_team") redirect("/dashboard");

  return (
    <>
      <PageHeader title="Add a publication scheme entry" />

      <p className="govuk-body">
        The entry is created as a draft. You add the links and files on the next
        screen, and publish it when it is ready.
      </p>

      <SchemeEntryForm />
    </>
  );
}
