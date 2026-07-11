"""
VoxoMate CRM — FastAPI entry point.
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import engine
from app.models.base import Base
# Import all models so SQLAlchemy metadata is populated
from app.models import user  # noqa: F401

from app.routers import auth, users, tasks, departments, discussion
from app.services.scheduler import start_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Tables are created via Alembic migrations now (formal workflow)
    scheduler = start_scheduler()
    yield
    scheduler.shutdown(wait=False)


app = FastAPI(
    title=settings.APP_TITLE,
    version=settings.APP_VERSION,
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

API_PREFIX = "/api/v1"
app.include_router(auth.router, prefix=API_PREFIX)
app.include_router(users.router, prefix=API_PREFIX)
app.include_router(tasks.router, prefix=API_PREFIX)
app.include_router(departments.router, prefix=API_PREFIX)
app.include_router(discussion.router, prefix=API_PREFIX)


@app.get("/healthz", tags=["Health"])
async def health():
    return {"status": "ok", "version": settings.APP_VERSION}
