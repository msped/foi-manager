.PHONY: dev prod migrate makemigrations createsuperuser shell logs

dev:
	docker compose -f docker-compose.dev.yml up

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

logs:
	docker compose -f docker-compose.dev.yml logs -f

down:
	docker compose -f docker-compose.dev.yml down
