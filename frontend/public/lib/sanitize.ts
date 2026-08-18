import sanitizeHtml from "sanitize-html";

/**
 * Response bodies are authored by staff in a rich text editor and stored as
 * HTML. The internal app renders that HTML as-is, which is defensible behind
 * authentication — but the disclosure log republishes it to anonymous visitors,
 * so it gets sanitised at this boundary.
 *
 * The allowlist matches what the TipTap editor can actually produce. Anything
 * outside it is dropped rather than escaped, so a malformed paste degrades to
 * readable text instead of visible markup.
 */
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p",
    "br",
    "strong",
    "b",
    "em",
    "i",
    "u",
    "s",
    "ul",
    "ol",
    "li",
    "blockquote",
    "h2",
    "h3",
    "h4",
    "a",
    "code",
    "pre",
    "hr",
    "table",
    "thead",
    "tbody",
    "tr",
    "th",
    "td",
  ],
  allowedAttributes: {
    a: ["href", "title"],
    th: ["colspan", "rowspan", "scope"],
    td: ["colspan", "rowspan"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  // Links out of a public register should not leak the referring page or hand
  // the target window a handle back to ours.
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { rel: "noreferrer noopener" }),
  },
};

export function sanitizeResponseHtml(html: string): string {
  return sanitizeHtml(html ?? "", OPTIONS);
}
