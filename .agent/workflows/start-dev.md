---
description: Start the VoxoMate CRM development environment (backend + frontend)
---

// turbo-all

## Prerequisites
- MySQL 8.x running locally
- Python 3.11+ installed
- Node.js 18+ installed

## Steps

1. Create the MySQL database (first time only):
```sql
CREATE DATABASE voxomate CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

2. Set up the Python virtual environment (first time only):
```
cd backend && python -m venv venv
```

// turbo
3. Activate venv and install dependencies (first time only):
```
backend\venv\Scripts\activate && pip install -r backend\requirements.txt
```

4. Copy and configure environment file (first time only — edit DATABASE_URL & SECRET_KEY):
```
copy backend\.env.example backend\.env
```

// turbo
5. Start the FastAPI backend server:
```
backend\venv\Scripts\uvicorn app.main:app --reload --port 8001 --app-dir backend
```

// turbo
6. In a separate terminal, start the React frontend dev server:
```
cd frontend && npm run dev
```

## URLs
- Frontend:  http://localhost:5173
- API Docs:  http://localhost:8001/api/docs
- Health:    http://localhost:8001/healthz
