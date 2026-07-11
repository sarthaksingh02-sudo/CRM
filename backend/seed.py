"""
Seed script — creates initial departments and a Tier-1 admin user.
Run once after starting the app for the first time:

    cd backend
    python seed.py
"""
import asyncio
from passlib.context import CryptContext
from app.core.database import AsyncSessionLocal
from app.core.database import engine
from app.models.base import Base
from app.models import user  # register all models  # noqa: F401
from app.models.user import Department, User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

DEPARTMENTS = [
    "Design",
    "Content & Comms",
    "Post Production",
    "Digital",
]

from app.core.config import settings

ADMIN = {
    "email": settings.ADMIN_EMAIL,
    "password": settings.ADMIN_PASSWORD,
    "first_name": "Executive",
    "last_name": "Admin",
    "role_tier": 1,
}


async def seed():
    async with AsyncSessionLocal() as db:
        # Departments
        for name in DEPARTMENTS:
            from sqlalchemy import select
            result = await db.execute(select(Department).where(Department.name == name))
            if not result.scalar_one_or_none():
                db.add(Department(name=name))
                print(f"  ✅ Department: {name}")

        await db.flush()

        # Admin user
        from sqlalchemy import select
        result = await db.execute(select(User).where(User.email == ADMIN["email"]))
        if not result.scalar_one_or_none():
            db.add(User(
                email=ADMIN["email"],
                password_hash=pwd_context.hash(ADMIN["password"]),
                first_name=ADMIN["first_name"],
                last_name=ADMIN["last_name"],
                role_tier=ADMIN["role_tier"],
                is_active=True,
            ))
            print(f"  ✅ Admin user: {ADMIN['email']} / {ADMIN['password']}")
        else:
            print(f"  ℹ️  Admin already exists: {ADMIN['email']}")

        await db.commit()
        print("\n🌱 Seed complete!")


if __name__ == "__main__":
    asyncio.run(seed())
