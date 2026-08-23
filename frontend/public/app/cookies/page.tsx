import type { Metadata } from "next";
import Link from "next/link";
import Breadcrumbs from "@/components/govuk/Breadcrumbs";
import { branding } from "@/lib/branding";

export const metadata: Metadata = {
  title: "Cookies",
  description: "How this service uses cookies.",
};

/**
 * Accurate as written, and it has to stay that way.
 *
 * This service sets exactly one cookie, and it is strictly necessary, which is
 * what lets the portal skip a consent banner under regulation 6(4) of PECR.
 * Adding anything that is not strictly necessary — analytics above all —
 * changes the legal position: it needs a banner, prior consent, and a row in
 * the table below. The absence of a banner is a claim this page is making.
 */
export default function CookiesPage() {
  return (
    <>
      <Breadcrumbs items={[{ href: "/", text: "Home" }, { text: "Cookies" }]} />

      <div className="govuk-grid-row">
        <div className="govuk-grid-column-two-thirds">
          <h1 className="govuk-heading-xl">Cookies</h1>

          <p className="govuk-body-l">
            Cookies are small files saved on your device by a website. This
            service uses one.
          </p>

          <h2 className="govuk-heading-m">Essential cookies</h2>

          <p className="govuk-body">
            We set one cookie, and only after you have verified your email
            address to check the progress of a request. It is what keeps you
            signed in for the hour that follows, so we do not have to email you
            a new code on every page.
          </p>

          <table className="govuk-table">
            <caption className="govuk-table__caption govuk-table__caption--m govuk-visually-hidden">
              Cookies this service sets
            </caption>
            <thead className="govuk-table__head">
              <tr className="govuk-table__row">
                <th scope="col" className="govuk-table__header">
                  Name
                </th>
                <th scope="col" className="govuk-table__header">
                  What it does
                </th>
                <th scope="col" className="govuk-table__header">
                  Expires
                </th>
              </tr>
            </thead>
            <tbody className="govuk-table__body">
              <tr className="govuk-table__row">
                <td className="govuk-table__cell">
                  <code>foi_track</code>
                </td>
                <td className="govuk-table__cell">
                  Keeps you signed in after you enter the code we email you, so
                  you can see the progress of your requests.
                </td>
                <td className="govuk-table__cell">1 hour</td>
              </tr>
            </tbody>
          </table>

          <p className="govuk-body">
            The cookie cannot be read by scripts running in your browser, and it
            holds no information about you beyond proof that you verified your
            address. Selecting <strong>Finish</strong> on your requests page
            deletes it immediately.
          </p>

          <h2 className="govuk-heading-m">Why we do not ask you to accept cookies</h2>

          <p className="govuk-body">
            A website only has to ask permission for cookies that are not
            strictly necessary. Ours is strictly necessary — without it, the
            check-a-request pages cannot work at all — so there is nothing to
            consent to and no banner to dismiss.
          </p>

          <h2 className="govuk-heading-m">We do not measure your visit</h2>

          <p className="govuk-body">
            {branding.organisationName} does not use analytics, advertising or
            any other tracking cookies on this service. We do not build a
            profile of what you look at, and nothing here is shared with
            advertisers.
          </p>

          <p className="govuk-body">
            You are entitled to make a Freedom of Information request without
            being counted. Browsing the{" "}
            <Link className="govuk-link" href="/disclosure-log">
              disclosure log
            </Link>{" "}
            leaves nothing behind on your device.
          </p>

          <h2 className="govuk-heading-m">Deleting cookies</h2>

          <p className="govuk-body">
            You can delete cookies through your browser settings at any time. If
            you delete ours, you will be signed out of the check-a-request pages
            and will need a new code to sign back in. Nothing else on this
            service is affected.
          </p>

          <p className="govuk-body">
            How we handle the information you give us is covered separately in
            our{" "}
            <Link className="govuk-link" href="/privacy">
              privacy notice
            </Link>
            .
          </p>
        </div>
      </div>
    </>
  );
}
