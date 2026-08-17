"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Runs GOV.UK Frontend's progressive enhancement over the current page.
 *
 * Re-runs on navigation because App Router swaps the DOM without a reload, so
 * components rendered by the new page would otherwise never be initialised.
 */
export default function GovukInit() {
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;

    // Imported dynamically: govuk-frontend touches HTMLElement at module scope,
    // which throws when this client component is pre-rendered on the server.
    import("govuk-frontend").then(({ initAll }) => {
      if (cancelled) return;

      // The template's inline script normally does this before hydration. Guard
      // in case it hasn't run, otherwise initAll bails with a SupportError.
      if (!document.body.classList.contains("govuk-frontend-supported")) {
        document.body.classList.add("js-enabled");
        if ("noModule" in HTMLScriptElement.prototype) {
          document.body.classList.add("govuk-frontend-supported");
        }
      }

      initAll({
        onError: (error) => {
          // Elements already enhanced on a previous navigation throw InitError.
          // That's expected here; anything else is worth seeing.
          if (error instanceof Error && error.name === "InitError") return;
          console.error(error);
        },
      });
    });

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return null;
}
