# VoxoMate CRM — Executed Tasks Log

> Last updated: 2026-07-10

---

## 🛠️ Technology Stack

### Core Frameworks & Databases
- **Backend:** FastAPI (Python asynchronous API framework)
- **Frontend:** React 19 (orchestrated via Vite build tooling)
- **Database:** MySQL 8.0+ (relational storage engine)
- **ORM / Driver:** SQLAlchemy 2.0 (async session) & `aiomysql` (async DB driver wrapper)

### Key Libraries & Packages
- **Data Serialization & Validation:** Pydantic v2 (FastAPI schemas)
- **Authentication & Encryption:** JWT (PyJWT signature keys) & Passlib (Bcrypt hashing context)
- **Asynchronous Scheduler:** APScheduler (Background job scheduler for rollover tasks)
- **Client API Communication:** Axios (Request/response interceptors & token synchronization)
- **Routing & RBAC Guards:** React Router v6 & React Context API state
- **Date & Time formatting:** date-fns (Offset naive dates to browser local timezone / IST)
- **Design Icons:** Lucide React

---

## ✅ Backend

| # | Task | File(s) |
|---|------|---------|
| 1 | SQLAlchemy async ORM models — User, Task, Department, TaskComment, TaskAttachment, TaskAuditLog | `backend/app/models/user.py` |
| 2 | Pydantic v2 request/response schemas for all resources | `backend/app/schemas/schemas.py` |
| 3 | Async SQLAlchemy engine + session factory + `get_db()` dependency | `backend/app/core/database.py` |
| 4 | Pydantic Settings config loading from `.env` | `backend/app/core/config.py` |
| 5 | JWT token create/decode + `require_tier1/2/3` dependency factory | `backend/app/core/security.py` |
| 6 | Auth router — `POST /api/v1/auth/token` (OAuth2 password flow) | `backend/app/routers/auth.py` |
| 7 | Users router — full CRUD + soft-delete (Tier 1 only), RBAC-scoped list | `backend/app/routers/users.py` |
| 8 | Departments router — list (public auth) + create (Tier 1 only) | `backend/app/routers/departments.py` |
| 9 | Tasks router — full CRUD + state machine endpoints | `backend/app/routers/tasks.py` |
| 10 | Task state machine: `start`, `progress`, `submit-review`, `review-decision` | `backend/app/routers/tasks.py` |
| 11 | Overdue rollover cron via APScheduler (runs at midnight) | `backend/app/services/scheduler.py` |
| 12 | Audit logging service (`write_audit()`) — logs status changes, progress jumps, date shifts | `backend/app/services/audit.py` |
| 13 | Department & personal metrics endpoints | `backend/app/routers/tasks.py` |
| 14 | FastAPI app factory — CORS, lifespan, router registration | `backend/app/main.py` |
| 15 | `backend/app/__init__.py` — required for `uvicorn app.main:app` to work | `backend/app/__init__.py` |
| 16 | `seed.py` — auto-creates DB, seeds 4 departments + Tier-1 admin | `backend/seed.py` |
| 17 | `.env.example` template for database URL and secret key | `backend/.env.example` |
| 18 | `requirements.txt` with pinned versions (incl. `greenlet`, `bcrypt==4.0.1`) | `backend/requirements.txt` |
| 19 | `pool_pre_ping=False` fix for aiomysql + SQLAlchemy ping() signature bug | `backend/app/core/database.py` |
| 20 | User re-activation endpoint (`PATCH /users/{user_id}/reactivate`) | `backend/app/routers/users.py` |
| 21 | Universal nested SQL relationships eager loading via `selectinload` for Task/Comment serialization | `backend/app/routers/tasks.py` |

---

## ✅ Frontend

| # | Task | File(s) |
|---|------|---------|
| 22 | Full dark-mode design system — CSS variables, typography, badges, cards, board layout | `frontend/src/index.css` |
| 23 | Axios API client with JWT interceptor + 401 auto-logout | `frontend/src/services/api.js` |
| 24 | Task, user, and department service helpers (trailing-slash fix applied) | `frontend/src/services/taskService.js` |
| 25 | JWT AuthContext — login, logout, persisted token, user decode | `frontend/src/context/AuthContext.jsx` |
| 26 | React Router v6 — `ProtectedLayout` (auth guard) + `TierGuard` (RBAC) | `frontend/src/App.jsx` |
| 27 | LoginPage — glassmorphism dark-mode design, error handling | `frontend/src/pages/LoginPage.jsx` |
| 28 | DashboardPage — greeting, 6 stat cards, pie chart, bar chart, active tasks list | `frontend/src/pages/DashboardPage.jsx` |
| 29 | TasksPage — Kanban board + list view + search + filters (status, priority, overdue) | `frontend/src/pages/TasksPage.jsx` |
| 30 | AnalyticsPage — personal/dept metrics, pie, bar, radial charts, summary table (Tier 1 & 2) | `frontend/src/pages/AnalyticsPage.jsx` |
| 31 | UsersPage — team directory table, soft-delete deactivation & reactivate actions | `frontend/src/pages/UsersPage.jsx` |
| 32 | DepartmentsPage — dept grid with colour-coded avatars, create form | `frontend/src/pages/DepartmentsPage.jsx` |
| 33 | TaskCard — status badge, priority badge, progress bar, overdue indicator | `frontend/src/components/tasks/TaskCard.jsx` |
| 34 | TaskDetailModal — state machine actions, progress slider, comments, audit log (Tier-gated) | `frontend/src/components/tasks/TaskDetailModal.jsx` |
| 35 | CreateTaskModal — brand/title/dept/assignee/dates form | `frontend/src/components/tasks/CreateTaskModal.jsx` |
| 36 | Sidebar — navigation links, user avatar, sign-out | `frontend/src/components/layout/Sidebar.jsx` |
| 37 | Shared UI — `<Spinner>`, `<EmptyState>`, `<ProgressBar>`, status/priority badges | `frontend/src/components/ui/Shared.jsx` |
| 38 | `index.html` — SEO meta tags, title | `frontend/index.html` |
| 39 | `frontend/.env` — `VITE_API_URL` pointing relative to proxy route for LAN client support | `frontend/.env` |
| 40 | Trailing-slash fix on all API calls to prevent 307 redirect auth header drop | `frontend/src/services/taskService.js` |
| 41 | Add Member modal form details & Reactivate client-side function bindings | `frontend/src/pages/UsersPage.jsx` |
| 42 | Vite Dev Server proxy configuration routing client `/api` directly to backend host | `frontend/vite.config.js` |

---

## ✅ Infrastructure & Docs

| # | Task | File(s) |
|---|------|---------|
| 43 | `/start-dev` workflow — turbo-annotated startup steps | `.agent/workflows/start-dev.md` |
| 44 | `README.md` — full project tree, quickstart, RBAC table, state machine diagram, API reference | `README.md` |
| 45 | `executed.md` — this file | `executed.md` |


---

## 🧪 Testing Plan (Today)

### Role 1 — Executive Admin (MD) `admin@voxomate.com / Admin@123`
- [ ] Login
- [ ] Create a new Department (e.g. "Strategy")
- [ ] Create a new Team Member (Dept Head, Tier 2) via Users → Add member
- [ ] Create a new Task and assign it to a staff member
- [ ] View Analytics page — dept metrics charts
- [ ] Deactivate a test user

### Role 2 — Department Head (Tier 2)
- [ ] Login as a Dept Head (after admin creates them)
- [ ] View only department-scoped tasks on Tasks page
- [ ] Accept/reject (rework) a task in "In Review" state with mandatory comment
- [ ] View Analytics — dept-level only

### Role 3 — Staff / Individual (Tier 3)
- [ ] Login as staff member
- [ ] See only tasks assigned to them
- [ ] Click "Start" on a yet_to_start task
- [ ] Move progress slider and save
- [ ] Submit task for review
- [ ] Cannot access Analytics or Team pages (guard test)
