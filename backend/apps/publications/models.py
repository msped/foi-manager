import uuid

from django.conf import settings
from django.contrib.postgres.indexes import GinIndex
from django.contrib.postgres.search import SearchVector, SearchVectorField
from django.db import models


def _scheme_upload_to(instance, filename):
    """A UUID directory per file, with the uploaded name left intact inside it.

    The directory is what makes the URL unguessable. Putting the UUID in the
    path rather than the filename means a download still arrives as
    `annual-accounts-2025.pdf` rather than as a hex string, which matters when
    the person saving it is a member of the public with no other context.

    This is the only thing standing between a draft entry's document and the
    open internet. `MEDIA_ROOT` is served flat — by `static()` in development
    and by a web server in production — so an entry's `status` gates the
    listing, never the file. A document uploaded to a draft is live from the
    moment it is saved; it is merely at an address nobody can arrive at by
    guessing or by counting. Unpublishing an entry therefore revokes nothing,
    and deleting the item is the only way to take a file back. That trade was
    made deliberately in favour of keeping direct media serving.
    """
    return f"publications/scheme/{uuid.uuid4()}/{filename}"


class PublicationSchemeEntry(models.Model):
    """One class of information published under section 19 of the Act.

    An entry is a signpost rather than a document. It names something the
    authority publishes as a matter of course, describes it, and points at
    however many actual files or pages make it up — see
    `PublicationSchemeItem`, which is where the pointing happens.
    """

    class Category(models.TextChoices):
        WHO_WE_ARE = "who_we_are", "Who we are and what we do"
        FINANCES = "finances", "What we spend and how we spend it"
        PRIORITIES = "priorities", "What our priorities are and how we are doing"
        DECISIONS = "decisions", "How we make decisions"
        POLICIES = "policies", "Our policies and procedures"
        LISTS_REGISTERS = "lists_registers", "Lists and registers"
        SERVICES = "services", "The services we offer"

    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        PUBLISHED = "published", "Published"

    title = models.CharField(max_length=300)
    category = models.CharField(max_length=20, choices=Category.choices)
    #: HTML, authored in the same editor as case responses. Sanitised where it
    #: is rendered to the public rather than on the way in, matching how
    #: `DisclosureLogEntry.response_text` is handled.
    description = models.TextField(blank=True)
    #: Gates the first publication only. Nothing stops an already-published
    #: entry being edited in place, and those edits are live immediately —
    #: what an entry holds is a title, a description and some links, and taking
    #: a statutory publication offline to fix a typo costs more than it saves.
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.DRAFT
    )
    published_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="published_scheme_entries",
    )
    published_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Matched against a request being drafted on the public portal, to offer
    # the scheme before someone spends twenty working days asking for something
    # already on it.
    #
    # Title above description, because the title is the thing the entry is
    # called and a description is free to wander into context and caveats.
    #
    # `category` is deliberately absent. Its label is fixed text shared by every
    # entry filed under it, so indexing it would make one request mentioning
    # spending match all eight finance entries at once — a deflection screen
    # offering eight unrelated things teaches people to skip it.
    #
    # `description` is HTML and goes in as HTML, for the reason given on
    # `DisclosureLogEntry.search_vector`: the `english` parser recognises and
    # drops tags, so the markup contributes no lexemes.
    search_vector = models.GeneratedField(
        expression=SearchVector("title", weight="A", config="english")
        + SearchVector("description", weight="B", config="english"),
        output_field=SearchVectorField(),
        db_persist=True,
    )

    class Meta:
        ordering = ["category", "title"]
        indexes = [
            GinIndex(fields=["search_vector"], name="scheme_entry_search_gin"),
        ]

    def __str__(self):
        return self.title


class PublicationSchemeItem(models.Model):
    """One link or one file belonging to an entry.

    Separate from the entry because the relationship is genuinely one-to-many,
    not because it tidies away blank columns. Publication schemes are full of
    classes made of many files: spending over £500 is published monthly, annual
    accounts and senior salaries yearly, and each of those accumulates
    indefinitely. Holding a single URL and a single file on the entry forced one
    entry per file — `Annual accounts 2023`, `Annual accounts 2024` — which
    reads as three unrelated classes of information when it is one.

    One model with a `kind` rather than a model per kind. The items under an
    entry are shown as a single ordered list, usually newest first, and
    interleaving separate tables into one order needs a union at every call
    site. `sort_order` here is one column and one `ORDER BY`.
    """

    class Kind(models.TextChoices):
        LINK = "link", "Link to a web page"
        DOCUMENT = "document", "Uploaded document"

    entry = models.ForeignKey(
        PublicationSchemeEntry,
        on_delete=models.CASCADE,
        related_name="items",
    )
    kind = models.CharField(max_length=20, choices=Kind.choices)
    #: What the link is called on the page. Optional because an uploaded file
    #: already carries a name worth showing; see `display_label`.
    label = models.CharField(max_length=300, blank=True)
    url = models.URLField(blank=True)
    document = models.FileField(upload_to=_scheme_upload_to, blank=True, null=True)
    sort_order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        # `pk` breaks ties so the order is total. Items are entered together and
        # default to sort_order 0, and a list that reshuffles between requests
        # is worse than one in an arbitrary but fixed order.
        ordering = ["sort_order", "pk"]

    def __str__(self):
        return self.display_label

    @property
    def filename(self) -> str:
        """The uploaded name, without the UUID directory in front of it."""
        return self.document.name.rsplit("/", 1)[-1] if self.document else ""

    @property
    def display_label(self) -> str:
        """Never empty, so a link on the public page always has text.

        Falls back to the entry's title rather than to the filename or the
        address. Both of those are technically more specific and both read
        badly — `https://example.gov.uk/finance/2025/q1-spend.xlsx` as link text
        is noise, and a filename is whoever-saved-it's private shorthand.

        Reaching `entry` is free wherever items arrive through
        `prefetch_related("items")`: Django populates the forward cache on
        prefetched reverse-related objects, so this is not a query per item.
        """
        return self.label or self.entry.title


class DisclosureLogEntry(models.Model):
    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        PUBLISHED = "published", "Published"
        REJECTED = "rejected", "Rejected"

    case = models.OneToOneField(
        "cases.Case",
        on_delete=models.CASCADE,
        related_name="disclosure_log_entry",
    )
    title = models.CharField(max_length=500, blank=True)
    summary = models.TextField(blank=True)
    response_text = models.TextField(blank=True)
    date_received = models.DateField(null=True, blank=True)
    date_responded = models.DateField(null=True, blank=True)
    exemptions = models.ManyToManyField(
        "cases.CaseExemption",
        blank=True,
        related_name="disclosure_log_entries",
    )
    attachments = models.ManyToManyField(
        "documents.CaseDocument",
        blank=True,
        related_name="disclosure_log_entries",
    )
    status = models.CharField(
        max_length=20, choices=Status.choices, default=Status.DRAFT
    )
    published_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="published_disclosure_entries",
    )
    published_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True)
    rejected_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="rejected_disclosure_entries",
    )
    rejected_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="created_disclosure_entries",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # See the note on `Case.search_vector`. Weighted so that a term in the
    # title beats one in the request, which beats one buried in the response —
    # a published response can run to tens of thousands of words about a great
    # many things the request never asked for.
    #
    # `response_text` is HTML and goes in as HTML. Postgres's `english` parser
    # recognises and drops tags, so the markup contributes no lexemes; this is
    # the one place the stripping done for embeddings is not needed.
    search_vector = models.GeneratedField(
        expression=SearchVector("title", weight="A", config="english")
        + SearchVector("summary", weight="B", config="english")
        + SearchVector("response_text", weight="C", config="english"),
        output_field=SearchVectorField(),
        db_persist=True,
    )

    class Meta:
        ordering = ["-date_responded"]
        indexes = [
            GinIndex(fields=["search_vector"], name="pub_entry_search_gin"),
        ]

    def __str__(self):
        return f"{self.case.ref} — {self.title}"
