from django.apps import AppConfig


class PublicationsConfig(AppConfig):
    name = "apps.publications"

    def ready(self):
        from . import signals  # noqa: F401
