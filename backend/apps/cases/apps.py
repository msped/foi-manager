from django.apps import AppConfig


class CasesConfig(AppConfig):
    name = "apps.cases"

    def ready(self):
        # Imported for the @register side effect; nothing here is called.
        from . import checks  # noqa: F401
