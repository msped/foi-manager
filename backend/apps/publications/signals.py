"""Keeping stored files in step with the rows that point at them.

Django stopped deleting `FileField` contents on model delete in 1.3, for a good
reason: a file can be referenced from more than one row, and a rolled-back
transaction cannot un-delete it. Both of those caveats are worth stating
because neither applies here — a scheme item owns its upload outright, and the
upload path carries a fresh UUID directory per file, so no two items ever share
one.

What does apply is that `MEDIA_ROOT` is served flat and unauthenticated. A file
left behind after its row is gone is not merely wasted disk; it is a document
still published, at an address that still works, with nothing left in the
database recording that it exists. Deleting the item is the only way to
withdraw a document, so this receiver is what makes that true.
"""

from django.db.models.signals import post_delete
from django.dispatch import receiver

from .models import PublicationSchemeItem


@receiver(post_delete, sender=PublicationSchemeItem)
def delete_item_file(sender, instance, **kwargs):
    """Remove the upload once its item is gone.

    `post_delete` rather than `pre_delete` so the file survives a delete that
    fails. `save=False` because the row it would save to no longer exists.

    Fires for cascades too, which is the case that matters most: deleting an
    entry takes its items with it, and without this the documents of a deleted
    entry would stay online indefinitely.
    """
    if instance.document:
        instance.document.delete(save=False)
