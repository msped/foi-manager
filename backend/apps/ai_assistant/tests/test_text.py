from apps.ai_assistant.text import content_hash, html_to_text, normalise


class TestHtmlToText:
    def test_block_tags_become_word_boundaries(self):
        """The bug this function exists for.

        `strip_tags` alone turns a table row into `500Agency`, a token that
        appears in no request anyone will ever make and that the embedder has
        never seen.
        """
        html = "<table><tr><td>500</td><td>Agency staff</td></tr></table>"
        assert html_to_text(html) == "500 Agency staff"

    def test_inline_tags_do_not_split_words(self):
        """The opposite mistake: spacing every tag breaks words apart."""
        assert html_to_text("<p><strong>Coun</strong>cil spending</p>") == (
            "Council spending"
        )

    def test_paragraphs_are_separated(self):
        html = "<p>First request.</p><p>Second request.</p>"
        assert html_to_text(html) == "First request. Second request."

    def test_line_breaks_separate(self):
        assert html_to_text("Line one<br>Line two") == "Line one Line two"

    def test_entities_are_decoded(self):
        assert html_to_text("<p>Parks &amp; open spaces</p>") == "Parks & open spaces"

    def test_escaped_markup_survives_as_text(self):
        """Unescaping happens after stripping, not before.

        A requester who writes `&lt;p&gt;` in a form field typed text, not
        markup. Unescaping first would promote it to a tag and delete it along
        with whatever it wrapped.
        """
        assert html_to_text("Tags like &lt;p&gt; are text") == "Tags like <p> are text"

    def test_empty_input(self):
        assert html_to_text("") == ""
        assert html_to_text(None) == ""


class TestContentHash:
    def test_reformatting_alone_is_not_a_change(self):
        """Staleness must track meaning, not whitespace.

        Otherwise every save that reflowed a paragraph would re-embed the whole
        record for nothing.
        """
        assert content_hash("agency  staff\n spend") == content_hash(
            "agency staff spend"
        )

    def test_different_text_hashes_differently(self):
        assert content_hash("agency staff") != content_hash("agency stuff")

    def test_field_boundaries_are_preserved(self):
        """Parts are separated, so moving text between fields is a change.

        Without a separator, ("ab", "c") and ("a", "bc") would collide and an
        edit that moved a word from the title into the summary would be missed.
        """
        assert content_hash("ab", "c") != content_hash("a", "bc")

    def test_normalise_strips_and_collapses(self):
        assert normalise("  a   b  ") == "a b"
        assert normalise("") == ""
