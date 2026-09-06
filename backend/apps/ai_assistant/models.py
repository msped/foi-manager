"""Stored vectors for the two things this service searches over.

One row per source record, cascading from it. Two properties are load-bearing:

Nothing here stores the text that was embedded. A vector plus a hash is enough
to search and to detect staleness, and neither can be read back as a request. A
copy of the text would be personal data living outside the retention rules that
govern the record it was copied from.

Everything cascades. When a case is deleted for retention, its vector goes with
it, with no second deletion path to remember or get wrong.
"""

from django.db import models
from pgvector.django import HnswIndex, VectorField

#: Fixed by `nomic-embed-text`. A literal, not `settings.AI_EMBEDDING_DIMENSIONS`
#: — a field width is a column definition, and reading it from settings would
#: mean an environment variable could silently put the database and the
#: migration history out of step. The setting exists so `ai.W002` can report the
#: disagreement instead.
EMBEDDING_DIMENSIONS = 768


class EmbeddingBase(models.Model):
    """Shared bookkeeping for deciding whether a stored vector is still valid.

    Two independent reasons it might not be: the source text changed, or the
    model that produced it did. Kept as separate fields so a model swap can be
    found and reindexed without having to guess which rows were affected.
    """

    embedding_model = models.CharField(max_length=100)
    content_hash = models.CharField(max_length=64)
    embedded_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True

    def is_stale(self, current_hash: str, current_model: str) -> bool:
        return (
            self.content_hash != current_hash or self.embedding_model != current_model
        )


class CaseEmbedding(EmbeddingBase):
    """A live case, searchable by what was asked.

    Internal only. Cases contain unredacted requester detail, so anything that
    can surface one is behind `IsFOITeam` — a similarity endpoint over these
    would otherwise be a way around the assignee scoping on the case list.
    """

    case = models.OneToOneField(
        "cases.Case",
        on_delete=models.CASCADE,
        related_name="embedding",
    )
    request_vector = VectorField(dimensions=EMBEDDING_DIMENSIONS)

    class Meta:
        indexes = [
            HnswIndex(
                name="ai_case_request_vector_hnsw",
                fields=["request_vector"],
                m=16,
                ef_construction=64,
                opclasses=["vector_cosine_ops"],
            )
        ]

    def __str__(self):
        return f"Embedding for {self.case.ref}"


class DisclosureLogEntryEmbedding(EmbeddingBase):
    """A published entry, searchable from both ends.

    Two vectors because the two surfaces ask different questions. Someone
    part-way through writing a request wants a request like theirs, and matches
    against `request_vector`. Someone searching the disclosure log wants an
    answer, and takes the better of the two. Collapsing them into one vector
    would serve both badly.

    `answer_vector` is nullable: an entry can be published with its response
    still empty, and a zero vector would be a confident-looking match for
    nothing.

    One hash covers both targets. Re-embedding a response because someone fixed
    a typo in the title is wasted work, but it happens in a background task on a
    corpus this size, and two hashes is two more things to keep in step.
    """

    entry = models.OneToOneField(
        "publications.DisclosureLogEntry",
        on_delete=models.CASCADE,
        related_name="embedding",
    )
    request_vector = VectorField(dimensions=EMBEDDING_DIMENSIONS)
    answer_vector = VectorField(dimensions=EMBEDDING_DIMENSIONS, null=True, blank=True)

    class Meta:
        indexes = [
            HnswIndex(
                name="ai_entry_request_vector_hnsw",
                fields=["request_vector"],
                m=16,
                ef_construction=64,
                opclasses=["vector_cosine_ops"],
            ),
            HnswIndex(
                name="ai_entry_answer_vector_hnsw",
                fields=["answer_vector"],
                m=16,
                ef_construction=64,
                opclasses=["vector_cosine_ops"],
            ),
        ]

    def __str__(self):
        return f"Embedding for {self.entry.case.ref}"
