"""What gets embedded, and how it is reduced to text first.

Nothing here is stored. The text these functions build is handed to the
embedder and discarded; only the resulting vector and a hash of the input are
kept. That is deliberate — a stored copy of a request would be a second home for
personal data, outside the retention period that governs the first one.
"""

import hashlib
import html
import re

from django.utils.html import strip_tags

#: Tags whose boundaries are word boundaries. `strip_tags` deletes tags without
#: putting anything in their place, so a table row of `<td>500</td><td>Agency
#: </td>` reduces to `500Agency` — one token that appears in no request anyone
#: will ever make. Only block-level tags are listed: doing this for inline tags
#: instead splits `<strong>Coun</strong>cil` into two words.
_BLOCK_TAGS = (
    "address|article|aside|blockquote|br|dd|div|dl|dt|h[1-6]|hr|li|ol|p|pre|"
    "section|table|tbody|td|tfoot|th|thead|tr|ul"
)
_BLOCK_TAG_RE = re.compile(rf"</?(?:{_BLOCK_TAGS})\b[^>]*>", re.IGNORECASE)
_WHITESPACE_RE = re.compile(r"\s+")


def html_to_text(value: str) -> str:
    """Flatten rich text to something worth embedding.

    Applies to the embedding path only. `response_text` stays HTML everywhere it
    is actually read — the disclosure log, the outbound email — because that is
    what the editor produced and what those surfaces render.
    """
    if not value:
        return ""

    spaced = _BLOCK_TAG_RE.sub(" ", value)
    # unescape after stripping, not before: `&lt;p&gt;` in the source is text a
    # requester typed, not markup, and unescaping first would promote it to a
    # tag that then gets deleted along with the words inside it.
    text = html.unescape(strip_tags(spaced))
    return _WHITESPACE_RE.sub(" ", text).strip()


def normalise(value: str) -> str:
    """Collapse whitespace so reformatting alone never looks like a new edit."""
    if not value:
        return ""
    return _WHITESPACE_RE.sub(" ", value).strip()


def case_request_text(case) -> str:
    """The embed target for a case: what was asked, in the requester's words.

    `summary` leads when staff have written one, because it is the version with
    the ambiguity taken out, but the original follows rather than being replaced
    — a summary is written for a colleague who has already read the request, and
    routinely drops the specifics that make two requests recognisably alike.
    """
    return normalise(" ".join(filter(None, [case.summary, case.request_text])))


def entry_request_text(entry) -> str:
    """The embed target for matching a new request against a published one.

    `summary` is seeded from the case's request text and then reviewed by staff
    before publication, so it is a request in publication-safe form. That is
    what makes it usable on the public side without a PII judgement.
    """
    return normalise(" ".join(filter(None, [entry.title, entry.summary])))


def entry_answer_text(entry) -> str:
    """The embed target for matching against what was actually disclosed.

    Separate from the request vector because the two public surfaces want
    different things: someone part-way through writing a request is looking for
    a request like theirs, and someone searching the disclosure log is looking
    for an answer.
    """
    return html_to_text(entry.response_text)


def content_hash(*parts: str) -> str:
    """Fingerprint of the exact text that was embedded.

    Compared against on every sweep to decide what needs redoing. Kept separate
    from the model stamp so the two reasons a vector goes stale — the text
    changed, or the model did — stay independently detectable.
    """
    joined = "\x1f".join(normalise(part) for part in parts)
    return hashlib.sha256(joined.encode()).hexdigest()
