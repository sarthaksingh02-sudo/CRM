# VoxoMate CRM — Internal Task & Team Management

> Full-stack CRM and task management platform for digital marketing agencies.  
> **Stack:** React 19 · FastAPI · MySQL · SQLAlchemy 2 · JWT · APScheduler

---

## 🗂 Project Structure

```
voxo-mate/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py               ← FastAPI app factory + lifespan
│   │   ├── core/
│   │   │   ├── config.py         ← Pydantic Settings (.env)
│   │   │   ├── database.py       ← Async SQLAlchemy engine + get_db()
│   │   │   └── security.py       ← JWT create/decode + RBAC dependency factory
│   │   ├── models/
│   │   │   └── user.py           ← All ORM models (User, Task, Comment, Attachment, AuditLog)
│   │   ├── schemas/
│   │   │   └── schemas.py        ← Pydantic v2 request/response schemas
│   │   ├── routers/
│   │   │   ├── auth.py           ← POST /auth/token (JWT login)
│   │   │   ├── users.py          ← User CRUD + soft-delete
│   │   │   ├── tasks.py          ← Task CRUD + full state machine + metrics
│   │   │   └── departments.py    ← Department CRUD
│   │   └── services/
│   │       ├── audit.py          ← write_audit() helper
│   │       └── scheduler.py      ← APScheduler midnight overdue cron
│   ├── seed.py                   ← One-time database seed (departments + admin)
│   ├── requirements.txt
│   └── .env.example
└── frontend/
    └── src/
        ├── App.jsx               ← Router + ProtectedLayout + TierGuard
        ├── context/
        │   └── AuthContext.jsx   ← JWT auth state + login/logout
        ├── services/
        │   ├── api.js            ← Axios instance with JWT interceptor
        │   └── taskService.js    ← All API call helpers
        ├── components/
        │   ├── layout/Sidebar.jsx
        │   ├── tasks/TaskCard.jsx
        │   ├── tasks/TaskDetailModal.jsx   ← State machine actions + progress slider
        │   ├── tasks/CreateTaskModal.jsx
        │   └── ui/Shared.jsx     ← ProgressBar, badges, spinner, toast…
        ├── pages/
        │   ├── LoginPage.jsx
        │   ├── DashboardPage.jsx ← Stats + charts + active tasks
        │   ├── TasksPage.jsx     ← Kanban board + list view + filters
        │   ├── AnalyticsPage.jsx ← Pie, bar, radial charts + dept table
        │   ├── UsersPage.jsx     ← Team management + soft-delete
        │   └── DepartmentsPage.jsx
        └── index.css             ← Full dark-mode design system
```

---

## 🚀 Quick Start & Deployment Guide

### 1. MySQL — create the database
```sql
CREATE DATABASE voxomate CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 2. Backend — Python virtual environment
```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # macOS/Linux
pip install -r requirements.txt
```

### 3. Backend — configure environment
```bash
# Copy the template and fill in your credentials
copy .env.example .env
```

Edit `backend/.env` with your production settings.

### 4. Backend — Database Migrations (Alembic)
Instead of development-only table generation, apply migrations to set up or update the schema:
```bash
cd backend
# Run migrations to bring the database to the latest schema version
venv\Scripts\alembic upgrade head
```

### 5. Seed initial data (first time only)
```bash
cd backend
venv\Scripts\python seed.py
```
This creates the 4 departments and the default admin account:
| Email | Password | Role |
|---|---|---|
| admin@voxomate.com | Admin@123 | Executive Admin (Tier 1) |

### 6. Backend — Start production/dev server
- **Dev:** `backend\venv\Scripts\uvicorn app.main:app --reload --port 8001 --host 0.0.0.0 --app-dir backend`
- **Production:** Run uvicorn behind a reverse proxy (e.g. Nginx) using Gunicorn workers:
  ```bash
  gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8001
  ```

API Docs → **http://localhost:8001/api/docs**

### 7. Frontend — Production Build
For local development:
```bash
cd frontend
npm install      # if not done yet
npm run dev
```

For production deployment:
```bash
cd frontend
npm install
npm run build
```
This compiles the frontend code to highly optimized, static HTML, CSS, and JS files located in `frontend/dist/`. These files can be quickly served using Nginx, Cloudflare Pages, Vercel, or Netlify.

---

## 🔐 RBAC Tiers

| Tier | Roles | Permissions |
|---|---|---|
| **1 — Executive Admin** | MD, Head of REV, Business Head/HR | Global CRUD, user create/deactivate, all metrics |
| **2 — Dept Head** | Design, Content & Comms, Post Production | Dept-scoped CRUD, task review decisions, dept metrics |
| **3 — Staff** | Design, CCP, Digital, Content | Read assigned tasks, update progress (1–99%), comments |

---

## ⚙️ Task State Machine

```
yet_to_start
    │  (assignee clicks "Start")
    ▼
in_progress  ◄──────────────────────────────────────────────┐
    │  progress slider: 1–99%                               │
    │  (assignee clicks "Submit for Review")                │
    ▼                                                       │ rework
in_review                                                   │ (dept head, mandatory comment + reset %)
    │  (dept head reviews)                                  │
    ├──── "Complete" ───► completed  (progress = 100%)      │
    └──── "Rework" ──────────────────────────────────────────
```

### Critical Logic
- `due_date` — **immutable**, used only for TAT reporting  
- `expected_delivery` — mutable, auto-rolled +1 day every midnight when overdue  
- `is_overdue` — set `True` by cron when `status != completed` AND `due_date < today`  
- Every **status change**, **progress jump > 25%**, and **date shift** writes a `TaskAuditLog` row  
- Users are **never hard-deleted** — `is_active = False` removes login access only

---

## 🌐 Key API Endpoints

| Method | Path | Tier | Description |
|---|---|---|---|
| `POST` | `/api/v1/auth/token` | — | Login → JWT |
| `GET` | `/api/v1/tasks` | All | List tasks (RBAC-scoped) |
| `POST` | `/api/v1/tasks` | 1, 2 | Create task |
| `PATCH` | `/api/v1/tasks/{id}/start` | 3 | yet_to_start → in_progress |
| `PATCH` | `/api/v1/tasks/{id}/progress` | 3 | **Slide progress %** (1–99) |
| `PATCH` | `/api/v1/tasks/{id}/submit-review` | 3 | in_progress → in_review |
| `PATCH` | `/api/v1/tasks/{id}/review-decision` | 1, 2 | Complete or rework decision |
| `GET` | `/api/v1/tasks/{id}/audit` | 1, 2 | Historical event audit log |
| `GET` | `/api/v1/tasks/metrics/department` | 1, 2 | Department aggregated KPIs |
| `GET` | `/api/v1/tasks/metrics/personal` | All | Personal user stats & metrics |
| `GET` | `/api/v1/users` | All | List team directory members |
| `POST` | `/api/v1/users` | 1 | Create new user (Team add member) |
| `PATCH` | `/api/v1/users/{id}/deactivate` | 1 | Soft-delete (deactivate) user |
| `PATCH` | `/api/v1/users/{id}/reactivate` | 1 | Restore (reactivate) user access |
| `GET` | `/api/v1/departments` | All | List all agency departments |
| `POST` | `/api/v1/departments` | 1 | Create a new department |
