"""System checks for the conditions under which retrieval quietly stops working.

Every surface that uses embeddings falls back to keyword search when they are
unavailable, which is the right behaviour in a request and a terrible property
to debug: a missing extension, an unpulled model and an empty index all look
identical from the outside — slightly worse search results, no errors anywhere.

Warnings rather than Errors, for the same reason as `cases.W001`: an Error fails
`manage.py check`, which would block the very `migrate` that fixes it.
"""

from django.conf import settings
from django.core.checks import Warning, register
from django.db import connection

from .models import EMBEDDING_DIMENSIONS


def _postgres() -> bool:
    return connection.vendor == "postgresql"


@register()
def pgvector_extension_is_installed(app_configs, **kwargs):
    """Warn when the `vector` extension is missing from the database.

    Prod points at an external database, where `CREATE EXTENSION` needs
    privileges a managed user is often not given. The migration attempts it; if
    it was granted, this check stays quiet forever, and if it was not, this is
    the only thing that says so in terms an operator can act on.
    """
    if not _postgres():
        return []

    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1 FROM pg_extension WHERE extname = 'vector'")
            if cursor.fetchone():
                return []
    except Exception:
        # No database to ask. Ordinary during image builds and `collectstatic`;
        # not something to report as a misconfiguration.
        return []

    return [
        Warning(
            "The pgvector extension is not installed on this database.",
            hint=(
                "Similarity search cannot run without it, and every surface "
                "that uses it will silently fall back to keyword search. Run "
                "`CREATE EXTENSION vector;` as a database superuser, or ask "
                "your database provider to enable it, then re-run migrations."
            ),
            id="ai.W001",
        )
    ]


@register()
def embedding_dimensions_agree(app_configs, **kwargs):
    """Warn when the configured dimension count disagrees with the columns.

    `AI_EMBEDDING_DIMENSIONS` is validated against; the column width is fixed in
    a migration. Changing `OLLAMA_EMBED_MODEL` to a model of a different size
    makes these disagree, and the failure that follows is a database error on
    every write with no mention of the setting that caused it.
    """
    if settings.AI_EMBEDDING_DIMENSIONS == EMBEDDING_DIMENSIONS:
        return []

    return [
        Warning(
            f"AI_EMBEDDING_DIMENSIONS is {settings.AI_EMBEDDING_DIMENSIONS}, but the "
            f"embedding columns are {EMBEDDING_DIMENSIONS}-dimensional.",
            hint=(
                "These have to match. Changing embedding model is a migration "
                "and a full reindex, not a settings change: alter the vector "
                "columns to the new width, update EMBEDDING_DIMENSIONS in "
                "apps/ai_assistant/models.py, then run `manage.py "
                "embed_backlog` to rebuild every vector. Vectors from two "
                "different models are not comparable, so a partial reindex "
                "ranks worse than no index at all."
            ),
            id="ai.W002",
        )
    ]


@register()
def embeddings_match_the_configured_model(app_configs, **kwargs):
    """Warn when stored vectors came from a model other than the current one.

    Cosine distance between vectors from two different models is a number with
    no meaning — it will still rank, just not by similarity. A mixed index is
    therefore worse than an empty one, because an empty one falls back to
    keyword search and a mixed one confidently returns noise.
    """
    if not _postgres():
        return []

    from .models import CaseEmbedding, DisclosureLogEntryEmbedding

    tables = connection.introspection.table_names()
    models = [
        m
        for m in (CaseEmbedding, DisclosureLogEntryEmbedding)
        if m._meta.db_table in tables
    ]
    if not models:
        # Before the first migrate. Ordinary setup.
        return []

    current = (
        "stub"
        if settings.AI_EMBEDDING_BACKEND == "stub"
        else settings.OLLAMA_EMBED_MODEL
    )

    found = set()
    for model in models:
        found.update(
            model.objects.exclude(embedding_model=current)
            .values_list("embedding_model", flat=True)
            .distinct()
        )

    if not found:
        return []

    others = ", ".join(sorted(found))
    return [
        Warning(
            f"Stored embeddings were produced by {others}, but the configured "
            f"model is {current}.",
            hint=(
                "Distances between vectors from different models are not "
                "comparable, so these rank as noise rather than by similarity. "
                "Run `manage.py embed_backlog` to re-embed them."
            ),
            id="ai.W003",
        )
    ]
