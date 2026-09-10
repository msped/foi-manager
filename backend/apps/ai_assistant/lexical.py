"""The keyword half of retrieval, and the reason there are two halves.

Vector similarity cannot tell "nothing relevant exists" from "something
relevant exists". Measured on this corpus, a nonsense request about peas
consumed by officers had a nearest neighbour at distance 0.2976, and a request
about dogs with four genuinely relevant matches had its nearest at 0.2984 — the
absolute numbers are indistinguishable, and the nonsense query's results were
the *more* tightly clustered of the two. No threshold, fixed or relative,
separates those cases.

Keyword search has the opposite strengths. It is poor at synonyms, which is why
vectors are here at all: nothing lexical connects a request about dogs to
`Livestock Worrying` or the `Pet Abduction Act`. But it knows with certainty
when a term simply does not occur in the corpus, which is exactly the judgement
vectors cannot make. Fusing the two covers both.

The query side is unusual. A search box gets a phrase; this gets a whole case,
which may run to several pages. So the tsquery is built from the case's own
lexemes — already stemmed and stopword-stripped by Postgres when it generated
the column — rather than from raw words.
"""

import logging
import re

from django.contrib.postgres.search import SearchQuery, SearchRank
from django.core.cache import cache
from django.db import connection
from django.db.models import F, Prefetch

from apps.cases.models import Case, CaseExemption
from apps.publications.models import DisclosureLogEntry

logger = logging.getLogger(__name__)

#: How many terms go into one tsquery, rarest first.
#:
#: Selection is by rarity rather than a frequency cutoff, and that distinction
#: matters more than the number. A cutoff decides each term in isolation, so it
#: can strip a request down to nothing: a request for "the number of vehicle
#: thefts recorded by the force in each of the last three calendar years"
#: reduced to `['three']`, because `vehicl` and `theft` both sat at 10.5% in a
#: corpus of 343 police cases and a 10% line cut them. Raising the line to 15%
#: would have readmitted `charg`, `arrest` and `incid`, which is what made an
#: XL Bully request match `Sexual Offences Handling`.
#:
#: Ranking has no such failure. The rarest terms a request contains are its
#: most distinctive ones whatever the corpus, so the query is never empty of
#: content and never dominated by filler. Common words appear only when the
#: request has nothing rarer to offer.
MAX_LEXEMES = 15

#: Terms above this share of the corpus are dropped outright, however few
#: alternatives a request has. Nothing occurring in a quarter of cases can
#: separate one from another — for a single police force that is `pleas` (66%),
#: `year` (59%), `forc` (48%), `offic` (28%). Set just under `offic`, which was
#: pulling a nonsense request about peas into every case mentioning officers,
#: and comfortably above `theft` and `vehicl` (both 10.5%), which a tighter
#: line cut from a request that was entirely about vehicle thefts.
MAX_DOCUMENT_FREQUENCY = 0.25

#: Words describing the *form* of a request rather than its subject.
#:
#: These cannot be found statistically, which is why they are written out. In
#: this corpus `attach` occurs in 1.2% of cases and so does `bulli`; `email` in
#: 2.6% and `dog` in 3.8%. By every frequency measure they are the same kind of
#: term, yet one names what a request is about and the other names the envelope
#: it came in. That distinction is a fact about FOI language, not about this
#: corpus, so no amount of counting will surface it.
#:
#: The cost of getting one wrong is small and one-directional: a request whose
#: subject genuinely is correspondence loses one search term among fifteen.
#: Leaving them in is worse — a request for "all emails mentioning
#: restructure" matched five unrelated cases on `email`, `attach` and `sent`,
#: none of which had anything to do with it.
#:
#: Stemmed, because they are compared against lexemes. The very common ones
#: (`pleas`, `provid`, `inform`, `request`) are absent on purpose: the
#: frequency ceiling already removes those, and listing them twice would hide
#: which mechanism is doing the work.
#:
#: Two kinds of word, both describing the request rather than its subject.
#:
#: The second group is the period a request covers, and it matters as much as
#: the first because almost every FOI request states one. A request about
#: library borrowing matched `Sex Offenders Supervised` and `Illegal Entering
#: of the UK` purely on `last` and `month`, while `librari`, `book`, `borrow`
#: and `branch` correctly matched nothing — the panel was answering "which
#: other requests mention a twelve-month period", which is every request.
#: Number words belong here too: `three` outranked `theft` in a request
#: entirely about vehicle thefts, because "the last three calendar years" is
#: scaffolding wearing the clothes of a rare term.
#:
#: `date` and `financi` are deliberately absent despite fitting the pattern.
#: `date` is what "dating" stems to, and there are real cases about dating
#: apps; `financi` cannot be told apart from financial crime. Where a word can
#: be either, it stays — a stray match costs less than a lost subject.
REQUEST_MECHANICS_LEXEMES = frozenset(
    {
        # How the request was made and what form the answer should take
        "attach",
        "breakdown",
        "broken",
        "copi",
        "correspond",
        "csv",
        "detail",
        "disclos",
        "document",
        "email",
        "excel",
        "figur",
        "format",
        "freedom",
        "kindli",
        "mention",
        "receiv",
        "repli",
        "respons",
        "sent",
        "sinc",
        "spreadsheet",
        "statist",
        "word",
        # The period it covers
        "annual",
        "annualli",
        "calendar",
        "current",
        "daili",
        "last",
        "month",
        "monthli",
        "period",
        "previous",
        "quarter",
        "recent",
        "week",
        "weekli",
        # Spelled-out quantities, which are almost always part of that period
        "one",
        "two",
        "three",
        "four",
        "five",
        "six",
        "seven",
        "eight",
        "nine",
        "ten",
        "eleven",
        "twelv",
        "twenti",
    }
)

#: Frequencies are only cached above this count. Anything rarer is already
#: distinctive enough to rank first, so it can be treated as unseen — which
#: keeps the cached map to the few thousand common terms rather than every
#: word in the corpus.
MIN_CACHED_FREQUENCY = 3

#: Below this many documents, frequency says nothing — in a corpus of five,
#: every term looks rare or common by accident. New deployments therefore rank
#: arbitrarily rather than wrongly.
MIN_CORPUS_FOR_FREQUENCY = 30

#: Recomputed at most this often. The figures move slowly, so staleness here
#: costs a slightly worse ordering, never a wrong one.
FREQUENCY_CACHE_SECONDS = 3600

_SAFE_LEXEME = re.compile(r"^[a-z0-9'\-]+$")


def document_frequencies(table: str) -> tuple[dict[str, int], int]:
    """How many documents in `table` contain each common term, and the total.

    Only terms at or above `MIN_CACHED_FREQUENCY` are kept. A term absent from
    the result is rarer than anything in it, which is all the caller needs to
    rank by — and it keeps the cached map to the common vocabulary instead of
    every word ever written into a request.
    """
    key = f"ai_assistant:document_frequencies:{table}"
    cached = cache.get(key)
    if cached is not None:
        return cached

    with connection.cursor() as cursor:
        cursor.execute(f"SELECT count(*) FROM {table}")  # noqa: S608 - fixed table names
        total = cursor.fetchone()[0]

        frequencies: dict[str, int] = {}
        if total >= MIN_CORPUS_FOR_FREQUENCY:
            cursor.execute(
                f"""
                SELECT word, ndoc
                FROM ts_stat('SELECT search_vector FROM {table}')
                WHERE ndoc >= %s
                """,  # noqa: S608 - fixed table names
                [MIN_CACHED_FREQUENCY],
            )
            frequencies = {row[0].lower(): row[1] for row in cursor.fetchall()}

    result = (frequencies, total)
    cache.set(key, result, FREQUENCY_CACHE_SECONDS)
    return result


def _rank_lexemes(rows, table) -> list[str]:
    """Pick the most distinctive terms from `(lexeme, weights)` rows.

    Shared by both entry points below so the two sides of a comparison are
    filtered and ranked identically. The only thing that varies is where the
    lexemes came from — a stored `search_vector` or a tsvector built on the
    fly — and Postgres produces both with the same parser.
    """
    frequencies, total = document_frequencies(table)
    # Only where there are real frequencies to judge against. An empty map
    # means the corpus is below `MIN_CORPUS_FOR_FREQUENCY`, and applying a
    # ceiling of `total * 0.35` there would drop every term — in a corpus of
    # two, the default frequency of 1 exceeds a ceiling of 0.7.
    ceiling = total * MAX_DOCUMENT_FREQUENCY if frequencies else None

    candidates = []
    for lexeme, weights in rows:
        term = lexeme.lower()
        if len(term) < 3 or not _SAFE_LEXEME.match(term):
            continue
        if term in REQUEST_MECHANICS_LEXEMES:
            continue
        # Purely numeric terms match any request quoting any year or figure,
        # and FOI requests quote a great many years and figures.
        if term.isdigit():
            continue

        # Absent from the map means rarer than anything in it — see
        # `MIN_CACHED_FREQUENCY`.
        frequency = frequencies.get(term, 1)
        if ceiling is not None and frequency > ceiling:
            continue

        # `unnest(tsvector)` yields weights as an array: a term in both the
        # subject and the body comes back as ['A', 'B'], and 'A' is the
        # subject. Only a tie-breaker — two terms of equal rarity are better
        # separated by which one names the request than by chance.
        #
        # A tsvector built by `to_tsvector` alone carries no `setweight`, so
        # every term comes back as ['D'] and this contributes nothing. That is
        # the correct outcome for `text_lexemes`: unsaved text has no subject
        # line to privilege.
        strongest = min(weights) if weights else "Z"
        candidates.append((frequency, strongest, term))

    candidates.sort()
    return [term for _frequency, _weight, term in candidates[:MAX_LEXEMES]]


def case_lexemes(case, table="cases_case") -> list[str]:
    """The case's most distinctive search terms, rarest first.

    Read back out of the generated `search_vector` rather than recomputed from
    the text, so the query side and the document side are guaranteed to have
    been through the same stemmer and the same stopword list. Recomputing in
    Python would be a second implementation of Postgres's English parser, and
    the two would drift.

    Ordered by how rare each term is in `table`, with a term in the subject
    line breaking ties. Cases and published entries have different
    vocabularies, so each is judged against its own corpus.
    """
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT lexeme, weights
            FROM cases_case, unnest(search_vector)
            WHERE cases_case.id = %s
            """,
            [case.pk],
        )
        rows = cursor.fetchall()

    return _rank_lexemes(rows, table)


def text_lexemes(text: str, table: str) -> list[str]:
    """The same, for text that is not a row yet.

    The public surfaces have nothing to read a stored `search_vector` from: on
    the request form the case does not exist, and a search box never becomes a
    row at all. Without this the public side could only run the vector arm, and
    a vector arm alone is precisely what the module docstring says cannot tell
    an empty result from a confident wrong one.

    Built in Postgres rather than stemmed in Python for the same reason
    `case_lexemes` reads the stored column: `to_tsvector` is the function that
    generated every document vector these will be matched against, so using
    anything else here would compare two different stemmers' output.
    """
    if not text.strip():
        return []

    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT lexeme, weights FROM unnest(to_tsvector('english', %s))",
            [text],
        )
        rows = cursor.fetchall()

    return _rank_lexemes(rows, table)


def build_query(lexemes) -> SearchQuery | None:
    """An OR of the given lexemes, or None when there is nothing to ask.

    `search_type="raw"` because these are already lexemes. Passing them through
    `plainto_tsquery` would stem them a second time, and double-stemming
    silently fails to match the very documents they came from.
    """
    if not lexemes:
        return None
    return SearchQuery(
        " | ".join(f"'{term}'" for term in lexemes),
        search_type="raw",
        config="english",
    )


def similar_cases(case, limit):
    """Cases sharing vocabulary with this one, best match first."""
    query = build_query(case_lexemes(case))
    if query is None:
        return []

    return list(
        Case.objects.exclude(pk=case.pk)
        .annotate(rank=SearchRank(F("search_vector"), query))
        .filter(rank__gt=0)
        .prefetch_related(Prefetch("exemptions", queryset=CaseExemption.objects.all()))
        .order_by("-rank")[:limit]
    )


def similar_published_entries(case, limit):
    """Published entries sharing vocabulary with this case.

    Excludes the case's own entry — a published case matches itself perfectly
    and tells an officer nothing.
    """
    query = build_query(case_lexemes(case, table="publications_disclosurelogentry"))
    return _published_entries(query, limit, exclude_case=case)


def published_entries_for_text(text: str, limit):
    """Published entries sharing vocabulary with text that has no row yet.

    Nothing to exclude: the text this is called with has never been saved, so
    there is no entry of its own for it to match.
    """
    query = build_query(text_lexemes(text, table="publications_disclosurelogentry"))
    return _published_entries(query, limit)


def _published_entries(query, limit, exclude_case=None):
    if query is None:
        return []

    qs = DisclosureLogEntry.objects.filter(status=DisclosureLogEntry.Status.PUBLISHED)
    if exclude_case is not None:
        qs = qs.exclude(case=exclude_case)

    return list(
        qs.annotate(rank=SearchRank(F("search_vector"), query))
        .filter(rank__gt=0)
        .select_related("case")
        .prefetch_related("exemptions")
        .order_by("-rank")[:limit]
    )
