from apps.publications.models import PublicationSchemeEntry, PublicationSchemeItem


class TestPublicationSchemeEntry:
    def test_create_entry(self, db, foi_team_user):
        entry = PublicationSchemeEntry.objects.create(
            title="Organisational structure",
            category=PublicationSchemeEntry.Category.WHO_WE_ARE,
            description="Our organisational structure and senior staff.",
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

    def test_new_entries_start_as_drafts(self, db, foi_team_user):
        """The default the whole feature rests on. An entry that arrived
        published by default would put unfinished work on a public site."""
        entry = PublicationSchemeEntry.objects.create(
            title="Half-written entry",
            category=PublicationSchemeEntry.Category.WHO_WE_ARE,
            created_by=foi_team_user,
        )
        assert entry.status == PublicationSchemeEntry.Status.DRAFT

    def test_all_ico_categories_exist(self):
        categories = [c.value for c in PublicationSchemeEntry.Category]
        assert "who_we_are" in categories
        assert "finances" in categories
        assert "priorities" in categories
        assert "decisions" in categories
        assert "policies" in categories
        assert "lists_registers" in categories
        assert "services" in categories


class TestPublicationSchemeItem:
    def test_entry_holds_many_items(self, db, foi_team_user):
        """The reason items exist at all — a class of information published
        monthly or annually accumulates files under one entry."""
        entry = PublicationSchemeEntry.objects.create(
            title="Spending over £500",
            category=PublicationSchemeEntry.Category.FINANCES,
            created_by=foi_team_user,
        )
        for month in range(3):
            PublicationSchemeItem.objects.create(
                entry=entry,
                kind=PublicationSchemeItem.Kind.LINK,
                label=f"Month {month}",
                url=f"https://example.gov.uk/spend/{month}",
                sort_order=month,
            )
        assert entry.items.count() == 3

    def test_items_order_by_sort_order(self, db, foi_team_user):
        entry = PublicationSchemeEntry.objects.create(
            title="Annual accounts",
            category=PublicationSchemeEntry.Category.FINANCES,
            created_by=foi_team_user,
        )
        PublicationSchemeItem.objects.create(
            entry=entry,
            kind=PublicationSchemeItem.Kind.LINK,
            label="2024",
            url="https://example.gov.uk/accounts/2024",
            sort_order=2,
        )
        PublicationSchemeItem.objects.create(
            entry=entry,
            kind=PublicationSchemeItem.Kind.LINK,
            label="2025",
            url="https://example.gov.uk/accounts/2025",
            sort_order=1,
        )
        assert [i.label for i in entry.items.all()] == ["2025", "2024"]

    def test_display_label_falls_back_to_the_entry_title(self, db, foi_team_user):
        """An anchor with no text is unreachable to anyone navigating by link,
        and a raw address as link text is barely better."""
        entry = PublicationSchemeEntry.objects.create(
            title="Pay policy",
            category=PublicationSchemeEntry.Category.POLICIES,
            created_by=foi_team_user,
        )
        item = PublicationSchemeItem.objects.create(
            entry=entry,
            kind=PublicationSchemeItem.Kind.LINK,
            url="https://example.gov.uk/pay",
        )
        assert item.display_label == "Pay policy"

    def test_a_label_wins_over_the_entry_title(self, db, foi_team_user):
        entry = PublicationSchemeEntry.objects.create(
            title="Annual accounts",
            category=PublicationSchemeEntry.Category.FINANCES,
            created_by=foi_team_user,
        )
        item = PublicationSchemeItem.objects.create(
            entry=entry,
            kind=PublicationSchemeItem.Kind.LINK,
            label="2024 to 2025",
            url="https://example.gov.uk/accounts/2025",
        )
        assert item.display_label == "2024 to 2025"

    def test_deleting_entry_cascades_to_items(self, db, foi_team_user):
        entry = PublicationSchemeEntry.objects.create(
            title="Doomed entry",
            category=PublicationSchemeEntry.Category.SERVICES,
            created_by=foi_team_user,
        )
        PublicationSchemeItem.objects.create(
            entry=entry,
            kind=PublicationSchemeItem.Kind.LINK,
            url="https://example.gov.uk/gone",
        )
        entry.delete()
        assert PublicationSchemeItem.objects.count() == 0
