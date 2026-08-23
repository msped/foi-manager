/**
 * The organisation's postal address, or nothing at all when none is set.
 *
 * Returns null rather than a placeholder, unlike [ContactEmail]. An address is
 * always offered alongside an email one, so a service with no address
 * published simply shows the email route — where a visible gap would only
 * suggest something had failed to load.
 */
export default function PostalAddress({
  lines,
}: {
  lines: readonly string[] | null;
}) {
  if (!lines) return null;

  return (
    <p className="govuk-body">
      {lines.map((line, i) => (
        // Index-keyed: address lines legitimately repeat (a town and a county
        // can share a name) and the list never reorders.
        <span key={i}>
          {line}
          <br />
        </span>
      ))}
    </p>
  );
}
