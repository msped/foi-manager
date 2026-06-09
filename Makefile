.PHONY: dev prod migrate makemigrations createsuperuser shell logs celery lint format

dev:
	docker compose -f docker-compose.dev.yml up -d

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

celery:
	cd backend && uv run celery -A config worker -l info

logs:
	docker compose -f docker-compose.dev.yml logs -f

down:
	docker compose -f docker-compose.dev.yml down

lint:
	cd backend && uv run ruff check .

format:
	cd backend && uv run ruff format .
