from pathlib import Path

from celery.schedules import crontab
from decouple import config

BASE_DIR = Path(__file__).resolve().parent.parent.parent

SECRET_KEY = config("SECRET_KEY")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.sites",
    # Required for the HNSW indexes on the embedding models; pgvector's index
    # classes subclass the Postgres ones, which check for this app.
    "django.contrib.postgres",
    # Third-party
    "rest_framework",
    "rest_framework.authtoken",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "dj_rest_auth",
    "dj_rest_auth.registration",
    "corsheaders",
    "allauth",
    "allauth.account",
    "allauth.socialaccount",
    "allauth.socialaccount.providers.microsoft",
    "storages",
    # Local
    "apps.users",
    "apps.cases",
    "apps.documents",
    "apps.publications",
    "apps.requester_portal",
    "apps.ai_assistant",
]

SITE_ID = 1

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "allauth.account.middleware.AccountMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": config("DB_NAME", default="foi_manager"),
        "USER": config("DB_USER", default="foi_manager"),
        "PASSWORD": config("DB_PASSWORD", default=""),
        "HOST": config("DB_HOST", default="localhost"),
        "PORT": config("DB_PORT", default="5432"),
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"
    },
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-gb"
TIME_ZONE = "Europe/London"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

# Leading slash matters: FileField.url is served to the public portal on another
# origin, so it has to be root-relative rather than relative to the current page.
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

AUTH_USER_MODEL = "users.User"

from datetime import timedelta

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(hours=8),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
}

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticated",),
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 25,
}

AUTHENTICATION_BACKENDS = [
    "django.contrib.auth.backends.ModelBackend",
    "allauth.account.auth_backends.AuthenticationBackend",
]

ACCOUNT_LOGIN_METHODS = {"email"}
ACCOUNT_SIGNUP_FIELDS = ["email*", "password1*", "password2*"]
ACCOUNT_EMAIL_VERIFICATION = "none"

FRONTEND_URL = config("FRONTEND_URL", default="http://localhost:3000")

REST_AUTH = {
    "USE_JWT": True,
    "JWT_AUTH_HTTPONLY": False,
    "USER_DETAILS_SERIALIZER": "apps.users.serializers.UserSerializer",
}

# Celery
CELERY_BROKER_URL = config("REDIS_URL", default="redis://localhost:6379/0")
CELERY_RESULT_BACKEND = config("REDIS_URL", default="redis://localhost:6379/0")
CELERY_TIMEZONE = TIME_ZONE

CELERY_BEAT_SCHEDULE = {
    # Reconciles the vector index against the text it describes. Nightly and
    # off-hours because it is repair work, not the main path — the signals
    # index each record as it changes, and this exists to catch what they could
    # not: dropped tasks, bulk updates, a model change, a restored backup.
    "sweep-stale-embeddings": {
        "task": "apps.ai_assistant.tasks.task_sweep_stale_embeddings",
        "schedule": crontab(hour="3", minute="0"),
    },
}

# Email
EMAIL_BACKEND = config(
    "EMAIL_BACKEND", default="django.core.mail.backends.smtp.EmailBackend"
)
EMAIL_HOST = config("EMAIL_HOST", default="localhost")
EMAIL_PORT = config("EMAIL_PORT", default=587, cast=int)
EMAIL_USE_TLS = config("EMAIL_USE_TLS", default=True, cast=bool)
EMAIL_HOST_USER = config("EMAIL_HOST_USER", default="")
EMAIL_HOST_PASSWORD = config("EMAIL_HOST_PASSWORD", default="")
DEFAULT_FROM_EMAIL = config("DEFAULT_FROM_EMAIL", default="foi@example.com")

# Ollama
OLLAMA_BASE_URL = config("OLLAMA_BASE_URL", default="http://localhost:11434")
OLLAMA_EMBED_MODEL = config("OLLAMA_EMBED_MODEL", default="nomic-embed-text")

# Ollama unloads a model from memory after five idle minutes and reloads it on
# the next request. That reload takes far longer than any timeout worth setting
# on a request path, so on a quiet service every embed would land on a cold
# model. Any negative duration pins it in memory instead.
#
# "-1m", not "-1": Ollama parses a string keep_alive as a Go duration and
# rejects a unitless one — `{"error":"time: missing unit in duration \"-1\""}`,
# a 400 on every call. The embedder coerces a bare number to an int, which
# Ollama reads as seconds and also accepts, so both spellings work; this default
# is the one that survives being copied into a .env by hand.
OLLAMA_KEEP_ALIVE = config("OLLAMA_KEEP_ALIVE", default="-1m")

# AI assistant
#
# There is no language model here, and the setting for one has been removed
# rather than left as an invitation. Both features — precedent for officers,
# published answers for the public — resolved to retrieval and counting, so the
# only model involved produces embeddings.
#
# One idea did want a language model: extracting a one-sentence subject at index
# time and embedding that, so request boilerplate ("please send by email", "for
# the last three years") would disappear by construction instead of being
# suppressed by the hand-written list in `lexical.REQUEST_MECHANICS_LEXEMES`. It
# was measured over 215 cases and it does not work — precision 0.685 to 0.688,
# and no recall recovered at all (2.17 of 5 vector results surviving the keyword
# gate, against 2.16 with the extracted subjects). Boilerplate shared by every
# document contributes a common component that largely cancels in cosine
# ranking, so there was nothing there to clean up.
#
# "stub" swaps in a deterministic embedder with no network calls, for tests.
AI_EMBEDDING_BACKEND = config("AI_EMBEDDING_BACKEND", default="ollama")

# Fixed by the model: nomic-embed-text is 768. Changing model almost certainly
# changes this, which is a column change and a full reindex, not a config edit —
# `ai.W002` fails loudly rather than letting mismatched vectors accumulate.
AI_EMBEDDING_DIMENSIONS = config("AI_EMBEDDING_DIMENSIONS", default=768, cast=int)

# Indexing runs in Celery, where slow is fine and giving up is not. Queries run
# in a request, where the reverse is true, so they get their own short budget
# and degrade to keyword search rather than making anyone wait.
AI_EMBED_TIMEOUT_INDEX = config("AI_EMBED_TIMEOUT_INDEX", default=30.0, cast=float)
AI_EMBED_TIMEOUT_QUERY = config("AI_EMBED_TIMEOUT_QUERY", default=1.5, cast=float)

# How many results each surface asks for, at most.
AI_INTERNAL_RESULT_COUNT = config("AI_INTERNAL_RESULT_COUNT", default=10, cast=int)
AI_PUBLIC_RESULT_COUNT = config("AI_PUBLIC_RESULT_COUNT", default=5, cast=int)

# Cosine distance beyond which a result is not shown at all. 0 is identical, 1
# is unrelated, 2 is opposite.
#
# This was originally left off, on the reasoning that officers are experts and
# can dismiss a bad suggestion in a second. That was wrong, and using it showed
# why: nearest-neighbour search returns the N nearest rows whether or not any of
# them are near, so on a small corpus a request about dogs is answered with
# whatever else exists — officer misconduct, catering figures. An irrelevant
# suggestion does not cost a moment's dismissal, it costs confidence in the
# panel, and a panel nobody trusts is worse than an empty one.
#
# 0.42 sits midway between the two things measured so far: a clearly relevant
# FOI pair at 0.378, and the closest *irrelevant* pair on real data at 0.464
# ("something about dogs" against a request about misconduct cases). Those two
# numbers are only 0.09 apart, which is the thing to understand about this
# setting — nomic-embed-text scores wholly unrelated English at around 0.5
# rather than 1.0, so the entire usable range is narrow and small changes here
# matter more than they look.
#
# Provisional. Measured since: this cutoff is a backstop against absurd matches
# and nothing more — it cannot separate relevant from irrelevant, because the
# scale moves with the query. A nonsense request scored 0.2976 to its nearest
# neighbour where a good one scored 0.2984. What decides relevance is the
# agreement between the two retrieval arms; see `retrieval.CANDIDATE_DEPTH`.
AI_MAX_DISTANCE = config("AI_MAX_DISTANCE", default=0.42, cast=float)

# FOI settings
FOI_STATUTORY_DAYS = 20
FOI_DEFAULT_INTERNAL_DAYS = 10
# How far ahead the dashboard's "due soon" tile looks. Working days, not
# calendar days, so the window tightens over a bank holiday weekend instead of
# quietly loosening exactly when there is least capacity to answer.
FOI_DUE_SOON_WORKING_DAYS = 5
FOI_GDPR_RETENTION_YEARS = config("FOI_GDPR_RETENTION_YEARS", default=3, cast=int)
FOI_REFERENCE_PREFIX = config("FOI_REFERENCE_PREFIX", default="FOI")
ORGANISATION_NAME = config("ORGANISATION_NAME", default="Organisation")
FOI_CONTACT_EMAIL = config("FOI_CONTACT_EMAIL", default="foi@example.com")
