# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All backend commands run via the Makefile from the project root:

```bash
make dev              # start Docker dev environment
make makemigrations   # generate Django migrations (cd backend && uv run python manage.py makemigrations)
make migrate          # apply migrations
make createsuperuser  # create a Django superuser
make shell            # open Django shell (uv run python manage.py shell)
make logs             # tail Docker logs
make down             # stop Docker containers
```

Never write migration files by hand — always use `make makemigrations` then `make migrate`.

Frontend (internal staff app):
```bash
cd frontend/internal && npm run dev   # dev server on :3000
cd frontend/internal && npm run build # production build
cd frontend/internal && npx tsc --noEmit  # type-check
```

## Architecture

This is a UK Freedom of Information (FOI) case management system. It consists of:

- `backend/` — Django 6 REST API with dj-rest-auth + SimpleJWT
- `frontend/internal/` — Next.js 16 staff app (App Router)
- `frontend/public/` — Next.js 16 public-facing portal (separate app)

### Backend (`backend/`)

**Django apps:**
- `apps/cases` — core FOI logic: Case, CaseNote, CaseAuditEvent, CaseExemption, CaseConsultation, BankHoliday, Department, RequesterCategory
- `apps/users` — custom User model (email login, `role` field: `foi_team` | `assignee`)
- `apps/documents` — document storage
- `apps/publications` — published FOI responses
- `apps/ai_assistant` — AI integration (not yet wired)

**Auth flow:** dj-rest-auth with `USE_JWT=True`. Access tokens live 8 hours. Better Auth on the frontend handles the session; the Django JWT access token is stored as `access_token` on the Better Auth session user object.

**API base:** `/api/v1/` — all endpoints live here. Key routes:
- `cases/` — full CRUD + actions: `acknowledge`, `transition`, `pause_clock`, `resume_clock`
- `cases/<id>/notes/`, `cases/<id>/exemptions/`, `cases/<id>/consultations/`
- `departments/`, `requester-categories/`, `bank-holidays/`
- `auth/login/`, `auth/logout/`, `auth/user/`, `auth/token/refresh/`
- `users/`

**Permissions:** `IsAuthenticated` for reads; `IsFOITeam` (checks `user.is_foi_team()`) for writes. Reference data viewsets use `pagination_class = None`.

**Deadline calculation:** `apps/cases/utils.py` — `add_working_days()` and `working_days_between()` query the `BankHoliday` model filtered by `settings.FOI_JURISDICTION` (default: `england`). `Case.save()` auto-calculates `statutory_deadline` from `submitted_at` on first save. `Case.acknowledge()` resets the deadline from the acknowledgement date.

**Sub-views pattern:** Large viewsets are split into separate files: `views.py`, `views_notes.py`, `views_exemptions.py`, `views_consultations.py`.

### Internal Frontend (`frontend/internal/`)

**Stack:** Next.js 16 App Router, TypeScript, GDS (GOV.UK Design System) styling via custom CSS.

**Auth:** Better Auth with a custom `djangoCredentialsPlugin`. Signs in against `POST /api/v1/auth/login/`, stores Django JWT access token on the session as `access_token`, keeps Django refresh token in an httpOnly cookie (`foi_refresh`). The `/api/auth/[...all]/` Next.js route handles all auth endpoints.

**Django API calls — critical rules:**
- **No Next.js API routes for Django proxying.** All Django calls go through typed service files in `lib/services/` (`cases.ts`, `users.ts`).
- All services use the axios singleton from `lib/services/django.ts`.
- Mutations use Next.js server actions (`"use server"`) in `actions.ts` files co-located with the page. Server actions call service functions directly and call `revalidatePath()` after mutations.
- The axios client (`lib/services/django.ts`) has a server/client split: server-side reads the Better Auth session via `auth.api.getSession()`; client-side maintains a `clientToken` cache and auto-refreshes via `authClient.$fetch("/refresh-django-token")` on 401.

**Page pattern:**
- Server components fetch data via service functions and pass it to client components as props.
- Client components handle interactivity; they receive data as props (not via hooks that fetch on mount).
- `redirect()` calls inside server actions must be re-thrown (they throw internally).

**Key types:** `lib/types.ts` — `CaseDetail`, `CaseListItem`, `CaseConsultation`, `BankHoliday`, `ApiUser`, `Department`.

**FOI-specific UI conventions:**
- GDS component classes: `govuk-heading-*`, `govuk-body*`, `govuk-table`, `govuk-select`, `govuk-input`, `govuk-textarea`, `govuk-summary-list`
- Custom layout classes: `foi-card`, `foi-grid-2`, `foi-grid-4`, `foi-col`, `foi-row`, `foi-spread`, `foi-tabs`, `foi-tab-btn`, `staff-header`, `staff-body`
- Status tags via `<StatusTag status={c.status} />`, generic tags via `<Tag colour="grey|green|yellow|red|orange">`

## FOI domain notes

- Statutory deadline is 20 working days from date of receipt (`submitted_at`), excluding weekends and bank holidays for the configured jurisdiction.
- `Case.acknowledge()` resets the deadline from the acknowledgement date, not receipt date.
- Clock can be paused/resumed; `clock_paused_days` tracks total days paused and extends the deadline accordingly.
- Consultations (`CaseConsultation`) track parts of a request sent to other departments/individuals for response. They have `scope`, `status` (pending/responded/withdrawn), optional `assignee` and `department`, and a `response` field.
- Exemptions reference UK FOIA sections (s.12–s.44).
- `FOI_JURISDICTION` setting (env var) controls which country's bank holidays are used: `england`, `wales`, `scotland`, or `northern_ireland`.
