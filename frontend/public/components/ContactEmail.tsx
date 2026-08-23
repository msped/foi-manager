/**
 * An email address, or a visible gap where the deployment has not set one.
 *
 * The gap is deliberate. These addresses carry the statutory pages: the route
 * for requesting an alternative format, and the route for exercising a data
 * protection right. An invented address is worse than an absent one, because
 * someone relying on it is sent nowhere and does not find out. A placeholder
 * that reads as unfinished fails in the direction that gets noticed.
 */
export default function ContactEmail({ email }: { email: string | null }) {
  if (!email) {
    return (
      <span className="govuk-hint govuk-!-display-inline">
        [no address published]
      </span>
    );
  }

  return (
    <a className="govuk-link" href={`mailto:${email}`}>
      {email}
    </a>
  );
}
