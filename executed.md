# VoxoMate CRM — Upgrade Implementation Plan & Final Execution Report

## AUDIT FINDINGS
- `api.js` — 401 logout interceptor ✅ already exists
- `security.py` — JWT token set to `ACCESS_TOKEN_EXPIRE_MINUTES` (480 min = 8 hrs) ✅ confirmed
- `UsersPage.jsx` — Email field ✅ already exists with `type="email" required`
- `UsersPage.jsx` — Deactivate button ✅ already wired to `userService.deactivate(id)` 
- `users.py (backend)` — Soft-delete endpoint ✅ exists at `PATCH /users/{id}/deactivate`
- **`api.js` base URL** — Falls back to `localhost:8000` but backend runs on `8001` locally → **BUG: Fix port** ✅ Fix applied.
- **Brand feature** — `brand_name` text column on Task model, needs FK upgrade to `brands` table ✅ FK upgraded.
- **Email alerts** — Scheduler exists (midnight cron) but no email function or 30-min alert job ✅ Complete.
- **Notifications bell** — Not implemented ✅ Full-stack implementation complete.
- **Brands section** — Not implemented ✅ Complete.

---

## IMPLEMENTED PHASES & SUCCESS CRITERIA

### PHASE 1 — QUICK BUG FIXES (No DB schema changes)
* [x] Fix `api.js` fallback port `8000` → `8001`
* [x] Update `Access-Control-Max-Age` / CORS_ORIGINS in config for local wildcard dev

### PHASE 2 — EMAIL ALERT SYSTEM (Backend)
* [x] Add `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USER`, `EMAIL_PASSWORD` to `config.py`
* [x] Create `backend/app/services/email_service.py` — async SMTP sender using `voxomate.imp@gmail.com`
* [x] Update `scheduler.py` — add 5-minute job checking HIGH priority tasks with `expected_delivery` in 30 min
* [x] Update `.env` and `.env.example` with email config

### PHASE 3 — IN-APP NOTIFICATIONS (Frontend)
* [x] Create `GET /api/v1/notifications` endpoint — returns overdue tasks and newly assigned tasks for current user
* [x] Create `frontend/src/components/ui/NotificationBell.jsx`
* [x] Wire bell into `App.jsx` mobile topbar and desktop sidebar header

### PHASE 4 — BRANDS FEATURE (Full-Stack, Major)
#### 4.1 Backend — New Models
* [x] Add `Brand`, `SocialAccount`, `BrandAssignment` SQLAlchemy models to `models/brands.py`
* [x] Add `brand_id` FK column to `Task` model (keep `brand_name` as nullable fallback)
* [x] Register new models in `main.py` imports
* [x] Create Alembic migration: `alembic revision --autogenerate -m "add_brands_and_social_accounts"`

#### 4.2 Backend — New Schemas
* [x] Add `BrandCreate`, `BrandRead`, `SocialAccountCreate`, `SocialAccountRead`, `BrandAssignmentCreate`, `BrandAssignmentRead` to `schemas.py`

#### 4.3 Backend — New Routers
* [x] Create `routers/brands.py` (CRUD for brands, Tier 1 only)
* [x] Create `routers/webhooks.py` (Meta webhook endpoint + auto-routing logic)
* [x] Register both routers in `main.py`

#### 4.4 Frontend — Brands UI
* [x] Create `pages/BrandsPage.jsx` — list brands, add brand, link social accounts, set brand assignment
* [x] Add `/brands` route to `App.jsx` (Tier 1 guard)
* [x] Add "Brands" nav item to `Sidebar.jsx` (Tier 1 only)
* [x] Update `taskService.js` to include brand service calls
* [x] Update `CreateTaskModal.jsx` — replace `brand_name` text field with `brand_id` dropdown

### PHASE 5 — MOBILE RESPONSIVENESS
* [x] Review and fix `index.css` breakpoints for Kanban board
* [x] Add responsive table overflow styles
* [x] Fix heading sizes on mobile

### PHASE 6 — STABILIZE REAL-TIME SYNCHRONIZATION (Latest Addition)
* [x] Forced IPv4 Loopback (`127.0.0.1`) connection for absolute stability under OS IPv6/IPv4 protocol resolution conflicts.
* [x] Eliminated HMR Dev Proxy looping crashes by direct port-to-port WebSocket handshake.
* [x] **Database Early-Commit Fix:** Committed SQLAlchemy transactions (`await db.commit()`) *before* blasting WebSocket JSON broadasts. This prevents read-committed transaction isolation race conditions (where other clients get the WS reload event, query the DB, and get old/stale data).
* [x] Added `onRefresh` callback fallbacks inside `TaskDetailModal.jsx` to trigger instant manual UI reloading during backend calls.

---

## SYSTEM RECONSTRUCT AND SUGGESTIONS

1. **Database Connection Pooling and Lifecycle:**
   - *Current Setup:* Uses a standard `AsyncSessionLocal` wrapper.
   - *Suggestion:* In production, configure optimized SQLAlchemy connection pooling:
     ```python
     engine = create_async_engine(
         DATABASE_URL,
         pool_size=20,
         max_overflow=10,
         pool_recycle=3600,
         pool_pre_ping=True
     )
     ```
     `pool_pre_ping=True` is vital to automatically repair database disconnects.

2. **WebSocket Scalability (Redis Pub/Sub Backend):**
   - *Current Setup:* Uses an in-memory `ConnectionManager` Python list/set.
   - *Suggestion:* In-memory manager works for single-process deployments (like `uvicorn --reload` or single-container instances). However, if scaling to multiple instances or workers (e.g. gunicorn `-w 4`), worker processes cannot share connection arrays. Migrate to a **Redis Pub/Sub** adapter to bridge events across concurrent workers.

3. **Background Job Reliability:**
   - *Current Setup:* In-app `AsyncIOScheduler` (APScheduler).
   - *Suggestion:* High-scale architectures should decouple heavy tasks (like email queues/meta webhook routing) to worker queues (e.g., Celery, Dramatiq, or ARQ backed by Redis) so route handlers don't slow down waiting for SMTP execution.

4. **Security Enhancements (Rate-Limiting):**
   - *Suggestion:* Implement key-based API rate limiting (e.g., `slowapi` or Nginx rate limits) to protect `/auth/token` and `/webhooks` endpoints from spam/denial-of-service threats.
