from apps.publications.models import PublicationSchemeEntry


class TestPublicationSchemeEntry:
    def test_create_entry(self, db, foi_team_user):
        entry = PublicationSchemeEntry.objects.create(
            title="Organisational structure",
            category=PublicationSchemeEntry.Category.WHO_WE_ARE,
            description="Our organisational structure and senior staff.",
            url="https://example.gov.uk/about/structure",
            created_by=foi_team_user,
        )
        assert entry.pk is not None

    def test_str(self, db, foi_team_user):
        entry = PublicationSchemeEntry.objects.create(
            title="Spending over £500",
            category=PublicationSchemeEntry.Category.FINANCES,
            created_by=foi_team_user,
        )
        assert "Spending over £500" in str(entry)

    def test_ordering_by_category_then_title(self, db, foi_team_user):
        PublicationSchemeEntry.objects.create(
            title="Z entry",
            category=PublicationSchemeEntry.Category.FINANCES,
            created_by=foi_team_user,
        )
        PublicationSchemeEntry.objects.create(
            title="A entry",
            category=PublicationSchemeEntry.Category.FINANCES,
            created_by=foi_team_user,
        )
        entries = list(PublicationSchemeEntry.objects.all())
        assert entries[0].title == "A entry"
        assert entries[1].title == "Z entry"

    def test_url_and_document_both_optional(self, db, foi_team_user):
        entry = PublicationSchemeEntry.objects.create(
            title="Empty entry",
            category=PublicationSchemeEntry.Category.WHO_WE_ARE,
            created_by=foi_team_user,
        )
        assert entry.url == ""
        assert not entry.document

    def test_all_ico_categories_exist(self):
        categories = [c.value for c in PublicationSchemeEntry.Category]
        assert "who_we_are" in categories
        assert "finances" in categories
        assert "priorities" in categories
        assert "decisions" in categories
        assert "policies" in categories
        assert "lists_registers" in categories
        assert "services" in categories
