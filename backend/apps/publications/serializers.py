from rest_framework import serializers

from apps.cases.models import Case, CaseExemption, CaseResponse
from apps.documents.models import CaseDocument

from .models import DisclosureLogEntry, PublicationSchemeEntry, PublicationSchemeItem


class PublicationSchemeItemSerializer(serializers.ModelSerializer):
    """One link or file on an entry, as staff see it."""

    filename = serializers.CharField(read_only=True)
    display_label = serializers.CharField(read_only=True)

    class Meta:
        model = PublicationSchemeItem
        fields = [
            "id",
            "entry",
            "kind",
            "label",
            "url",
            "document",
            "filename",
            "display_label",
            "sort_order",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["created_at", "updated_at"]

    def validate(self, attrs):
        """A link needs a URL, a document needs a file, and a second item needs
        a label.

        Checked here rather than on the model because `kind` and its payload
        can arrive in separate PATCHes, and `attrs` on a partial update holds
        only what changed — so the stored instance supplies the rest.
        """
        kind = attrs.get("kind") or getattr(self.instance, "kind", None)
        url = attrs.get("url", getattr(self.instance, "url", ""))
        document = attrs.get("document", getattr(self.instance, "document", None))

        if kind == PublicationSchemeItem.Kind.LINK and not url:
            raise serializers.ValidationError({"url": "A link needs a web address."})
        if kind == PublicationSchemeItem.Kind.DOCUMENT and not document:
            raise serializers.ValidationError(
                {"document": "A document item needs a file."}
            )

        # An unlabelled item is shown under the entry's own title, which reads
        # well while it is the only one and turns into a list of identical
        # links the moment it is not. The first item may therefore go without;
        # anything joining it may not.
        label = attrs.get("label", getattr(self.instance, "label", ""))
        entry = attrs.get("entry") or getattr(self.instance, "entry", None)
        if not label.strip() and entry is not None:
            siblings = entry.items.all()
            if self.instance is not None:
                siblings = siblings.exclude(pk=self.instance.pk)
            if siblings.exists():
                raise serializers.ValidationError(
                    {
                        "label": (
                            "Give this a label. The entry already has an item, "
                            "and without labels they would all be shown under "
                            "the entry's title."
                        )
                    }
                )

        return attrs

    def update(self, instance, validated_data):
        """Delete the superseded file when a document is replaced.

        Storage cleanup is the only revocation this design has. Uploads live at
        an unguessable path under an openly served `MEDIA_ROOT`, so a file left
        behind stays fetchable forever — and the file most likely to be
        replaced is the one being replaced *because it was wrong*.

        Captured before the update and deleted after it, so a failure part-way
        through leaves the old file in place rather than deleting it and then
        failing to save its replacement.
        """
        old_file = instance.document
        replacing = "document" in validated_data and validated_data["document"] != (
            old_file or None
        )

        instance = super().update(instance, validated_data)

        if replacing and old_file:
            old_file.delete(save=False)
        return instance


class PublicationSchemeEntrySerializer(serializers.ModelSerializer):
    items = PublicationSchemeItemSerializer(many=True, read_only=True)
    published_by_name = serializers.SerializerMethodField()

    class Meta:
        model = PublicationSchemeEntry
        fields = [
            "id",
            "title",
            "category",
            "description",
            "status",
            "published_by",
            "published_by_name",
            "published_at",
            "items",
            "created_at",
            "updated_at",
        ]
        # `status` moves through the publish/unpublish actions only. A plain
        # PATCH would skip the "does this entry point anywhere" check, which is
        # the one thing standing between a half-finished entry and the public
        # site.
        read_only_fields = [
            "status",
            "published_by",
            "published_by_name",
            "published_at",
            "created_at",
            "updated_at",
        ]

    def get_published_by_name(self, obj):
        return obj.published_by.get_full_name() if obj.published_by else None

    def create(self, validated_data):
        validated_data["created_by"] = self.context["request"].user
        return super().create(validated_data)


class PublicSchemeItemSerializer(serializers.ModelSerializer):
    """An item as the public sees it: somewhere to go, and what to call it."""

    label = serializers.CharField(source="display_label", read_only=True)

    class Meta:
        model = PublicationSchemeItem
        fields = ["id", "kind", "label", "url", "document"]


class PublicPublicationSchemeEntrySerializer(serializers.ModelSerializer):
    """An entry as the public sees it.

    `status`, `published_by` and `created_by` are absent rather than filtered
    in the frontend. The viewset that uses this only ever returns published
    entries, so the fields would carry no information — and leaving them off
    means no future change to the public page can accidentally render who
    inside the authority signed something off.
    """

    items = PublicSchemeItemSerializer(many=True, read_only=True)

    class Meta:
        model = PublicationSchemeEntry
        fields = [
            "id",
            "title",
            "category",
            "description",
            "items",
            "published_at",
            "updated_at",
        ]


class CaseExemptionBriefSerializer(serializers.ModelSerializer):
    code_display = serializers.CharField(source="get_code_display", read_only=True)

    class Meta:
        model = CaseExemption
        fields = ["id", "code", "code_display"]


class PublicExemptionSerializer(serializers.ModelSerializer):
    """Exemptions as shown to the public — the statutory code only.

    Deliberately excludes `notes`, which is internal casework commentary.
    """

    code_display = serializers.CharField(source="get_code_display", read_only=True)

    class Meta:
        model = CaseExemption
        fields = ["code", "code_display"]


class PublicAttachmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = CaseDocument
        fields = ["id", "original_filename", "file"]


#: How much of a request the disclosure log list shows before cutting it.
#:
#: `summary` is seeded from the case's request text at publication and edited by
#: staff, so it is usually a whole FOI request rather than the sentence the
#: field name suggests — several hundred words is ordinary. Ten of those on one
#: page made the list unreadable and buried the pagination.
#:
#: Cut server-side rather than clamped in CSS so the payload shrinks too, and so
#: the list still reads correctly with stylesheets unavailable.
SUMMARY_EXCERPT_CHARS = 300


def _excerpt(text: str) -> str:
    """Enough of a request to recognise it, cut at a word boundary."""
    text = (text or "").strip()
    if len(text) <= SUMMARY_EXCERPT_CHARS:
        return text
    return text[:SUMMARY_EXCERPT_CHARS].rsplit(" ", 1)[0] + "…"


class PublicDisclosureLogListSerializer(serializers.ModelSerializer):
    case_ref = serializers.CharField(source="case.ref", read_only=True)
    exemptions = PublicExemptionSerializer(many=True, read_only=True)
    summary = serializers.SerializerMethodField()

    class Meta:
        model = DisclosureLogEntry
        fields = [
            "id",
            "case_ref",
            "title",
            "summary",
            "date_received",
            "date_responded",
            "published_at",
            "exemptions",
        ]

    def get_summary(self, entry):
        return _excerpt(entry.summary)


class PublicDisclosureLogDetailSerializer(PublicDisclosureLogListSerializer):
    attachments = serializers.SerializerMethodField()

    # Undoes the list serializer's excerpt. Inheriting the field list is worth
    # keeping, but inheriting the truncation is not: this is the page someone
    # opens *because* they want the whole request, and it is the only place the
    # full text is published at all.
    summary = serializers.CharField(read_only=True)

    class Meta(PublicDisclosureLogListSerializer.Meta):
        fields = PublicDisclosureLogListSerializer.Meta.fields + [
            "response_text",
            "attachments",
        ]

    def get_attachments(self, obj):
        # Filtered in Python rather than the DB so the viewset's prefetch is
        # reused — the set per entry is small.
        public_docs = [a for a in obj.attachments.all() if a.is_public]
        return PublicAttachmentSerializer(
            public_docs, many=True, context=self.context
        ).data


class CaseDocumentBriefSerializer(serializers.ModelSerializer):
    class Meta:
        model = CaseDocument
        fields = ["id", "original_filename", "is_public"]


class QueueDisclosureLogEntrySerializer(serializers.ModelSerializer):
    exemptions = serializers.PrimaryKeyRelatedField(many=True, read_only=True)
    attachments = serializers.PrimaryKeyRelatedField(many=True, read_only=True)

    class Meta:
        model = DisclosureLogEntry
        fields = [
            "id",
            "title",
            "summary",
            "response_text",
            "date_received",
            "date_responded",
            "exemptions",
            "attachments",
            "status",
            "published_at",
        ]


class PublishQueueItemSerializer(serializers.ModelSerializer):
    sent_response = serializers.SerializerMethodField()
    exemptions = CaseExemptionBriefSerializer(many=True, read_only=True)
    documents = CaseDocumentBriefSerializer(many=True, read_only=True)
    disclosure_log_entry = serializers.SerializerMethodField()

    class Meta:
        model = Case
        fields = [
            "id",
            "ref",
            "summary",
            "request_text",
            "submitted_at",
            "sent_response",
            "exemptions",
            "documents",
            "disclosure_log_entry",
        ]

    def get_sent_response(self, case):
        for r in case.responses.all():
            if r.status == CaseResponse.Status.SENT:
                return {
                    "id": r.id,
                    "rendered_body": r.rendered_body,
                    "sent_at": r.sent_at.isoformat() if r.sent_at else None,
                }
        return None

    def get_disclosure_log_entry(self, case):
        try:
            return QueueDisclosureLogEntrySerializer(case.disclosure_log_entry).data
        except Exception:
            return None


class RejectedQueueItemSerializer(serializers.ModelSerializer):
    case_ref = serializers.CharField(source="case.ref", read_only=True)
    case_id = serializers.IntegerField(source="case.id", read_only=True)
    rejected_by_name = serializers.SerializerMethodField()

    class Meta:
        model = DisclosureLogEntry
        fields = [
            "id",
            "case_id",
            "case_ref",
            "title",
            "rejection_reason",
            "rejected_by_name",
            "rejected_at",
        ]

    def get_rejected_by_name(self, obj):
        return obj.rejected_by.get_full_name() if obj.rejected_by else None


class DisclosureLogEntrySerializer(serializers.ModelSerializer):
    exemptions = serializers.PrimaryKeyRelatedField(
        many=True, queryset=CaseExemption.objects.all()
    )
    attachments = serializers.PrimaryKeyRelatedField(
        many=True, queryset=CaseDocument.objects.all()
    )
    case_ref = serializers.CharField(source="case.ref", read_only=True)
    published_by_name = serializers.SerializerMethodField()
    rejected_by_name = serializers.SerializerMethodField()

    class Meta:
        model = DisclosureLogEntry
        fields = [
            "id",
            "case",
            "case_ref",
            "title",
            "summary",
            "response_text",
            "date_received",
            "date_responded",
            "exemptions",
            "attachments",
            "status",
            "published_by",
            "published_by_name",
            "published_at",
            "rejection_reason",
            "rejected_by",
            "rejected_by_name",
            "rejected_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "case_ref",
            "status",
            "published_by",
            "published_by_name",
            "published_at",
            "rejected_by",
            "rejected_by_name",
            "rejected_at",
            "created_at",
            "updated_at",
        ]

    def get_published_by_name(self, obj):
        return obj.published_by.get_full_name() if obj.published_by else None

    def get_rejected_by_name(self, obj):
        return obj.rejected_by.get_full_name() if obj.rejected_by else None

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        ret["exemptions_detail"] = [
            {"id": e.id, "code": e.code, "code_display": e.get_code_display()}
            for e in instance.exemptions.all()
        ]
        ret["attachments_detail"] = [
            {
                "id": a.id,
                "original_filename": a.original_filename,
                "is_public": a.is_public,
            }
            for a in instance.attachments.all()
        ]
        return ret

    def create(self, validated_data):
        validated_data["created_by"] = self.context["request"].user
        return super().create(validated_data)


class DisclosureLogListSerializer(serializers.ModelSerializer):
    case_ref = serializers.CharField(source="case.ref", read_only=True)
    case_id = serializers.IntegerField(source="case.id", read_only=True)
    published_by_name = serializers.SerializerMethodField()

    class Meta:
        model = DisclosureLogEntry
        fields = [
            "id",
            "case_id",
            "case_ref",
            "title",
            "date_responded",
            "published_by_name",
            "published_at",
        ]

    def get_published_by_name(self, obj):
        return obj.published_by.get_full_name() if obj.published_by else None
