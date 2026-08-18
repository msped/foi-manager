import type { Metadata } from "next";
import Link from "next/link";
import Breadcrumbs from "@/components/govuk/Breadcrumbs";
import { listPublicationScheme } from "@/lib/services/publications";
import type { PublicationSchemeEntry, SchemeCategory } from "@/lib/types";

export const metadata: Metadata = {
  title: "Publication scheme",
  description:
    "Classes of information we publish routinely, without anyone having to ask for them.",
};

/**
 * The seven classes from the Information Commissioner's model publication
 * scheme. Order is fixed rather than alphabetical, and every heading renders
 * whether or not we hold anything under it — an empty class is itself
 * meaningful information for someone deciding whether to make a request.
 */
const CATEGORIES: { key: SchemeCategory; title: string; description: string }[] = [
  {
    key: "who_we_are",
    title: "Who we are and what we do",
    description: "Our structure, locations, and who is responsible for what.",
  },
  {
    key: "finances",
    title: "What we spend and how we spend it",
    description: "Budgets, accounts, spending, procurement and contracts.",
  },
  {
    key: "priorities",
    title: "What our priorities are and how we are doing",
    description: "Strategies, performance against targets, and audits.",
  },
  {
    key: "decisions",
    title: "How we make decisions",
    description: "Decision-making processes, minutes, and consultations.",
  },
  {
    key: "policies",
    title: "Our policies and procedures",
    description: "Written protocols for delivering our services.",
  },
  {
    key: "lists_registers",
    title: "Lists and registers",
    description: "Registers we are required to keep and publish.",
  },
  {
    key: "services",
    title: "The services we offer",
    description: "What we provide, and guidance on how to use it.",
  },
];

function EntryLinks({ entry }: { entry: PublicationSchemeEntry }) {
  // An entry can point at an external page, an uploaded document, or both.
  const links: { href: string; text: string; download?: boolean }[] = [];
  if (entry.url) links.push({ href: entry.url, text: "View online" });
  if (entry.document)
    links.push({ href: entry.document, text: "Download document", download: true });

  if (links.length === 0) return null;

  return (
    <p className="govuk-body-s govuk-!-margin-bottom-0">
      {links.map((link, i) => (
        <span key={link.href}>
          {i > 0 && " · "}
          <a
            className="govuk-link"
            href={link.href}
            rel="noreferrer"
            download={link.download}
          >
            {link.text}
          </a>
        </span>
      ))}
    </p>
  );
}

export default async function PublicationSchemePage() {
  let entries: PublicationSchemeEntry[] | null = null;
  try {
    entries = await listPublicationScheme();
  } catch {
    entries = null;
  }

  return (
    <>
      <Breadcrumbs
        items={[{ href: "/", text: "Home" }, { text: "Publication scheme" }]}
      />

      <div className="govuk-grid-row">
        <div className="govuk-grid-column-two-thirds">
          <h1 className="govuk-heading-xl">Publication scheme</h1>

          <p className="govuk-body-l">
            Information we publish as a matter of course, so you do not have to
            ask for it.
          </p>

          <p className="govuk-body">
            Every public authority must have a publication scheme under section
            19 of the Freedom of Information Act 2000. It sets out the classes of
            information we routinely make available and keep up to date.
          </p>

          <div className="govuk-inset-text">
            This is not the same as our{" "}
            <Link className="govuk-link" href="/disclosure-log">
              disclosure log
            </Link>
            . The publication scheme is information we publish on our own
            initiative; the disclosure log is our answers to specific requests
            other people have already made. It is worth checking both.
          </div>

          {entries === null ? (
            <>
              <h2 className="govuk-heading-m">
                Sorry, the publication scheme is unavailable
              </h2>
              <p className="govuk-body">Try again later.</p>
            </>
          ) : (
            CATEGORIES.map((category) => {
              const items = entries.filter((e) => e.category === category.key);
              return (
                <section key={category.key}>
                  <h2 className="govuk-heading-m govuk-!-margin-top-8">
                    {category.title}
                  </h2>
                  <p className="govuk-body">{category.description}</p>

                  {items.length === 0 ? (
                    <p className="govuk-body govuk-hint">
                      We have not published anything under this class yet.
                    </p>
                  ) : (
                    <ul className="govuk-list">
                      {items.map((entry) => (
                        <li key={entry.id} className="govuk-!-margin-bottom-4">
                          <h3 className="govuk-heading-s govuk-!-margin-bottom-1">
                            {entry.title}
                          </h3>
                          {entry.description && (
                            <p className="govuk-body govuk-!-margin-bottom-1">
                              {entry.description}
                            </p>
                          )}
                          <EntryLinks entry={entry} />
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              );
            })
          )}

          <hr className="govuk-section-break govuk-section-break--l govuk-section-break--visible" />

          <p className="govuk-body">
            If what you need is not published here or in the{" "}
            <Link className="govuk-link" href="/disclosure-log">
              disclosure log
            </Link>
            , you can{" "}
            <Link className="govuk-link" href="/request">
              make a Freedom of Information request
            </Link>
            .
          </p>
        </div>
      </div>
    </>
  );
}
