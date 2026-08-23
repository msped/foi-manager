"use client";

import { useState } from "react";

export interface AccordionSection {
  /** Stable key. Also used to build the heading and content element ids. */
  key: string;
  heading: string;
  /** Optional line after the heading — a count, usually. */
  summary?: string;
  content: React.ReactNode;
}

/**
 * The GOV.UK accordion, rendered in its already-enhanced form and driven by
 * React state.
 *
 * govuk-frontend's own module is deliberately not used here, and this markup
 * carries no `data-module="govuk-accordion"` so that `initAll` leaves it alone.
 * That module works by rewriting the DOM it finds — replacing the heading span
 * with a generated <button>, wrapping the text in two more spans and injecting
 * a "Show all sections" control. React then owns the same nodes, and any
 * re-render (adding or deleting a row, say) reconciles against a tree the
 * module has already rearranged. The result is a component that works until
 * the first mutation and then quietly stops.
 *
 * So the enhanced structure is written out directly. The classes, the element
 * order, the visually-hidden dividers and the aria-label wording are all copied
 * from accordion.mjs so it looks and announces exactly like every other
 * accordion in the Design System.
 *
 * One deliberate difference: govuk-frontend hides collapsed content with
 * `hidden="until-found"`, letting find-in-page open a section. That relies on
 * the browser opening it behind the component's back, which React state cannot
 * see — the section would be visible while its button still read "Show". Plain
 * `hidden` keeps the two in step.
 */
export default function Accordion({
  id,
  sections,
  defaultExpanded = [],
}: {
  id: string;
  sections: AccordionSection[];
  /** Section keys open on first render. */
  defaultExpanded?: string[];
}) {
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(defaultExpanded)
  );

  const allOpen = sections.length > 0 && sections.every((s) => expanded.has(s.key));

  function toggle(key: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleAll() {
    setExpanded(allOpen ? new Set() : new Set(sections.map((s) => s.key)));
  }

  return (
    <div className="govuk-accordion" id={id}>
      <div className="govuk-accordion__controls">
        <button
          type="button"
          className="govuk-accordion__show-all"
          aria-expanded={allOpen}
          onClick={toggleAll}
        >
          <span
            className={`govuk-accordion-nav__chevron${
              allOpen ? "" : " govuk-accordion-nav__chevron--down"
            }`}
          />
          <span className="govuk-accordion__show-all-text">
            {allOpen ? "Hide all sections" : "Show all sections"}
          </span>
        </button>
      </div>

      {sections.map((section) => {
        const isOpen = expanded.has(section.key);
        const contentId = `${id}-content-${section.key}`;
        const headingId = `${id}-heading-${section.key}`;

        // Matches the label accordion.mjs builds: heading, summary, then the
        // action, comma-separated.
        const label = [
          section.heading,
          section.summary,
          isOpen ? "Hide this section" : "Show this section",
        ]
          .filter(Boolean)
          .join(" , ");

        return (
          <div
            key={section.key}
            className={`govuk-accordion__section${
              isOpen ? " govuk-accordion__section--expanded" : ""
            }`}
          >
            <div className="govuk-accordion__section-header">
              <h3 className="govuk-accordion__section-heading">
                <button
                  type="button"
                  className="govuk-accordion__section-button"
                  aria-controls={contentId}
                  aria-expanded={isOpen}
                  aria-label={label}
                  onClick={() => toggle(section.key)}
                >
                  <span
                    className="govuk-accordion__section-heading-text"
                    id={headingId}
                  >
                    <span className="govuk-accordion__section-heading-text-focus">
                      {section.heading}
                    </span>
                  </span>

                  <span className="govuk-visually-hidden govuk-accordion__section-heading-divider">
                    ,{" "}
                  </span>

                  {section.summary && (
                    <>
                      <span className="govuk-accordion__section-summary">
                        <span className="govuk-accordion__section-summary-focus">
                          {section.summary}
                        </span>
                      </span>
                      <span className="govuk-visually-hidden govuk-accordion__section-heading-divider">
                        ,{" "}
                      </span>
                    </>
                  )}

                  <span className="govuk-accordion__section-toggle" data-nosnippet="">
                    <span className="govuk-accordion__section-toggle-focus">
                      <span
                        className={`govuk-accordion-nav__chevron${
                          isOpen ? "" : " govuk-accordion-nav__chevron--down"
                        }`}
                      />
                      <span className="govuk-accordion__section-toggle-text">
                        {isOpen ? "Hide" : "Show"}
                      </span>
                    </span>
                  </span>
                </button>
              </h3>
            </div>

            <div
              id={contentId}
              className="govuk-accordion__section-content"
              hidden={!isOpen}
            >
              {section.content}
            </div>
          </div>
        );
      })}
    </div>
  );
}
