from decouple import config

from .base import *

DEBUG = False
SECRET_KEY = "test-secret-key-not-for-production"

# Postgres rather than SQLite, because similarity search is a database feature
# here: the ranking is `ORDER BY embedding <=> query` inside pgvector. On SQLite
# the `vector` column would still be created — SQLite accepts any type name —
# and every insert would appear to work, but the operator that does the actual
# ranking does not exist, so the one part of the AI assistant worth testing is
# the one part SQLite cannot run.
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": config("DB_NAME", default="foi_manager"),
        "USER": config("DB_USER", default="foi_manager"),
        "PASSWORD": config("DB_PASSWORD", default="foi_manager"),
        "HOST": config("DB_HOST", default="localhost"),
        "PORT": config("DB_PORT", default="5432"),
        "TEST": {"NAME": "foi_manager_test"},
    }
}

# Speed up password hashing in tests
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]

# Suppress emails in tests
EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"

CELERY_TASK_ALWAYS_EAGER = True

# Never reach for a model server from a test. The stub is deterministic, so
# assertions about ranking are assertions about the retrieval code rather than
# about whatever `nomic-embed-text` happened to think that day.
AI_EMBEDDING_BACKEND = "stub"

# Effectively no cutoff. The stub embeds by hashing tokens, so its distances are
# on an arbitrary scale with no relationship to the model's — a value tuned for
# nomic would filter these fixtures by coincidence, and retuning it in
# production would then break tests that are about something else entirely.
# Tests that are about the cutoff set it themselves with `override_settings`.
AI_MAX_DISTANCE = 2.0

# No caching between tests. The lexical arm caches corpus-wide term frequencies
# for an hour, which is right in a running service and wrong in a suite where
# every test builds a different corpus in the same process — one test's
# vocabulary would decide what the next test considers distinctive.
CACHES = {"default": {"BACKEND": "django.core.cache.backends.dummy.DummyCache"}}
