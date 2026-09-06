.PHONY: dev prod migrate makemigrations createsuperuser shell logs celery celery-beat embed-backlog lint format

# The dev stack is docker-compose.yml, not docker-compose.dev.yml — the latter
# has never existed in this repo, so these three targets all failed.
dev:
	docker compose up -d

prod:
	docker compose -f docker-compose.prod.yml up -d

migrate:
	cd backend && uv run python manage.py migrate

makemigrations:
	cd backend && uv run python manage.py makemigrations

createsuperuser:
	cd backend && uv run python manage.py createsuperuser

shell:
	cd backend && uv run python manage.py shell

# Threads, not the default prefork pool. On macOS a forked child segfaults
# (SIGSEGV) the first time it makes a network call, because the Objective-C
# runtime initialised in the parent is not fork-safe — which every task here
# does, whether calling Ollama or sending mail. Linux is unaffected, so the
# production compose file keeps prefork.
#
# Threads suit the work regardless: these tasks wait on HTTP and SMTP rather
# than compute. Concurrency 2 caps how many embeddings run at once, which also
# keeps a bulk backfill from pinning every core.
celery:
	cd backend && uv run celery -A config worker -l info --pool=threads --concurrency=2

celery-beat:
	cd backend && uv run celery -A config beat -l info

embed-backlog:
	cd backend && uv run python manage.py embed_backlog

logs:
	docker compose logs -f

down:
	docker compose down

lint:
	cd backend && uv run ruff check .

format:
	cd backend && uv run ruff format .
