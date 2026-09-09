"""What the internal panel shows an officer, and how each part is arrived at.

Precedent is retrieved by two independent methods, and only results both of
them find are shown.

The vector arm knows that a request about dogs relates to `Livestock Worrying`
and the `Pet Abduction Act`, which share no words with it. What it cannot do is
tell "nothing relevant exists" from "something relevant exists": measured on
this corpus, a nonsense request about peas had its nearest neighbour at distance
0.2976 and a dogs request with four genuinely relevant matches had its nearest
at 0.2984. Indistinguishable. Worse, the nonsense query's results were the
*tighter* cluster, so a relative threshold fails where an absolute one does.

The lexical arm has the opposite shape. It is blind to synonyms, but it knows
what vocabulary the corpus actually contains, which is the judgement vectors
cannot make.

Requiring agreement is what makes an empty panel possible. It costs recall — a
genuinely relevant case sharing no vocabulary is dropped — and that is the right
trade here: the panel exists to be trusted, and an officer who sees one dud
learns to skim past all of it. `AI_MAX_DISTANCE` survives only as a backstop on
the vector arm, no longer as the thing deciding what is relevant, because the
measurements above showed it cannot be.

Possible, but not guaranteed, and the difference is worth being honest about.
Measured against five off-topic requests written in ordinary FOI register, the
gate silences three; the other two return a result at every candidate depth
down to 3, because both arms rank the same wrong case at the very top. That is
false agreement rather than looseness, and no threshold or depth reaches it —
only something that judges the relation itself, which nothing here does. So the
panel should be read as "both methods found this", never as "this is relevant".

Exemption frequencies are counted. They say what was claimed on comparable
requests before, not what should be claimed on this one. Nothing here predicts
an exemption, and the wording that reaches the UI has to keep that distinction
intact — an exemption is a decision an officer makes and has to defend at
internal review.

Nothing is filtered by date, at any depth. Precedent does not expire: a refusal
on cost, or a public interest balance that was argued out once, stays good
reasoning until the circumstances change. If the public portal succeeds in
deflecting the routine questions, the requests that still reach an officer will
be the unusual ones — and the matching past case will be older and rarer, not
more recent. Age is a reason to surface a case, not to hide it.

Nothing here reports who made a request, either. The question this answers is
what was decided and why; the requester is a fact about a past case that bears
on neither. Repeat-request and aggregation handling under s.12(4) is a separate
concern, and would want its own feature rather than a badge on this one.
"""

import logging
from collections import Counter

from django.conf import settings
from django.db.models import Prefetch
from pgvector.django import CosineDistance

from apps.cases.models import Case, CaseExemption

from . import lexical
from .models import CaseEmbedding

logger = logging.getLogger(__name__)


def _case_vector(case):
    """The stored vector for a case, or None if it has not been indexed yet.

    None is an ordinary state, not an error: indexing is asynchronous, so a case
    created seconds ago has no vector and the panel simply has less to show.
    """
    embedding = CaseEmbedding.objects.filter(case=case).first()
    return embedding.request_vector if embedding else None


#: Reciprocal rank fusion constant. 60 is the value from the original TREC
#: work and is not sensitive here — with both arms capped at
#: `CANDIDATE_DEPTH`, appearing in both roughly doubles a result's score
#: whatever k is, and that ordering is the only thing used.
RRF_K = 60

#: How deep each arm looks before fusing. Wider than the panel shows, because a
#: result ranked tenth by one method and second by the other is exactly the
#: agreement worth surfacing, and a cap at the display size would hide it.
#:
#: 25 was too wide: at that depth a case ranked 25th by *both* arms counted as
#: agreement, which is barely a claim at all. Swept over the 339-case corpus,
#: scoring 75 topic-labelled cases against five off-topic probes:
#:
#:      depth   precision   results   empty    nonsense results
#:         25       0.565       7.0    1/75                 3.8
#:         15       0.602       4.4    5/75                 1.8
#:         12       0.623       3.3    7/75                 1.0
#:          8       0.687       2.1   11/75                 0.8
#:
#: 12 cuts off-topic results by 74% and silences three of the five probes, for
#: about half the panel's length. Below 8 the trade inverts — empty panels climb
#: steeply on cases that genuinely have precedent, while dud suppression barely
#: moves.
#:
#: Precision here is a floor, not a measurement: the labels are topic clusters
#: keyed on a title word, and they score genuinely correct matches as misses
#: (Clare's Law against domestic abuse, Professional Standards against
#: misconduct). They are applied identically to every depth, so the trend is
#: sound even though the level is pessimistic.
CANDIDATE_DEPTH = 12


def fuse(vector_ranked, lexical_ranked, limit):
    """Reciprocal rank fusion, keeping only what both arms found.

    Public because `public.py` fuses the same way. The gate is the load-bearing
    part of this design, and a second implementation of it on the surface facing
    the public is the last place it should be allowed to drift.

    Returns primary keys, best first.

    The intersection is the point rather than an optimisation. Plain RRF over
    the union always returns something — every arm always has a top result — so
    it cannot produce the empty panel that a novel request deserves. Requiring
    both arms to have found a result turns "the model's nearest neighbour" into
    "the model's nearest neighbour that also shares distinctive vocabulary",
    which is a claim worth putting in front of an officer.
    """
    scores = {}
    for ranked in (vector_ranked, lexical_ranked):
        for rank, pk in enumerate(ranked, start=1):
            scores[pk] = scores.get(pk, 0.0) + 1.0 / (RRF_K + rank)

    agreed = set(vector_ranked) & set(lexical_ranked)
    return sorted(agreed, key=lambda pk: -scores[pk])[:limit]


def similar_cases(case, limit=None):
    """Other cases that both arms agree resemble this one.

    Internal only, and the reason the endpoint is `IsFOITeam`. Case records hold
    unredacted requester details, so an endpoint returning nearest-neighbour
    cases to any authenticated user would be a way around the assignee scoping
    on the case list.
    """
    vector = _case_vector(case)
    if vector is None:
        return []

    limit = limit or settings.AI_INTERNAL_RESULT_COUNT
    vector_ranked = list(
        CaseEmbedding.objects.exclude(case=case)
        .annotate(distance=CosineDistance("request_vector", vector))
        .filter(distance__lte=settings.AI_MAX_DISTANCE)
        .order_by("distance")
        .values_list("case_id", flat=True)[:CANDIDATE_DEPTH]
    )
    lexical_hits = lexical.similar_cases(case, CANDIDATE_DEPTH)

    ordered_ids = fuse(vector_ranked, [c.pk for c in lexical_hits], limit)
    if not ordered_ids:
        return []

    by_id = {
        c.pk: c
        for c in Case.objects.filter(pk__in=ordered_ids).prefetch_related(
            Prefetch("exemptions", queryset=CaseExemption.objects.all())
        )
    }
    return [by_id[pk] for pk in ordered_ids if pk in by_id]


def exemption_frequencies(cases):
    """How often each exemption was claimed across a set of comparable cases.

    A count of the past, presented as such. It is evidence an officer weighs,
    and deliberately not a recommendation: the public interest test turns on the
    specific information requested and the circumstances at the time of the
    request, neither of which is captured by a request resembling another one.
    """
    counter = Counter()
    for case in cases:
        for exemption in case.exemptions.all():
            counter[exemption.code] += 1

    labels = dict(CaseExemption.Code.choices)
    return [
        {
            "code": code,
            "code_display": labels.get(code, code),
            "count": count,
            "case_count": len(cases),
        }
        for code, count in counter.most_common()
    ]


def case_insights(case):
    """Everything the case-detail panel needs, in one pass.

    One list of cases, not two. An earlier version searched published
    disclosure log entries separately from cases, which returned each published
    request twice — once as a case and once as its own entry — because a
    published case matches both. Deduplicating fixed the repetition but kept
    the split, and the split was the mistake: whether a response was published
    is decided *after* it was sent, by a different person for different
    reasons, and says nothing about how the request was handled. An officer
    looking for precedent wants the same answer either way.

    Publication survives only as a marker on a row, because a published
    response is wording that can be reused verbatim, which is worth knowing.
    """
    similar = similar_cases(case)

    return {
        "similar_cases": similar,
        "exemption_frequencies": exemption_frequencies(similar),
        "indexed": _case_vector(case) is not None,
    }
