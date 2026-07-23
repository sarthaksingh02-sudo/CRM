from typing import Annotated, Any
import json
from pydantic import BeforeValidator
from pydantic_settings import BaseSettings, SettingsConfigDict


def parse_cors_origins(v: Any) -> list[str]:
    if isinstance(v, str):
        if v.startswith("[") and v.endswith("]"):
            try:
                return json.loads(v)
            except Exception:
                pass
        return [x.strip() for x in v.split(",") if x.strip()]
    return v


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "mysql+aiomysql://root:password@localhost:3306/voxomate"

    # JWT
    SECRET_KEY: str = "CHANGE_ME_IN_PRODUCTION_VERY_LONG_SECRET"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 8  # 8h working day

    # App
    APP_TITLE: str = "VoxoMate CRM"
    APP_VERSION: str = "1.0.0"
    CORS_ORIGINS: Annotated[Any, BeforeValidator(parse_cors_origins)] = ["http://localhost:5173", "http://localhost:3000"]

    # Admin Identity Provider Setup
    ADMIN_EMAIL: str = "admin@voxomate.com"
    ADMIN_PASSWORD: str = "Admin@123"

    # Email / SMTP (for automated alerts)
    EMAIL_HOST: str = "smtp.gmail.com"
    EMAIL_PORT: int = 587
    EMAIL_USER: str = "voxomate.imp@gmail.com"
    EMAIL_PASSWORD: str = ""  # Set via env variable: EMAIL_PASSWORD
    EMAIL_FROM: str = "voxomate.imp@gmail.com"
    EMAILS_ENABLED: bool = False  # Set to True in prod once EMAIL_PASSWORD is set

    # Webhook Verify Token
    WEBHOOK_VERIFY_TOKEN: str = "voxomate_verify_token_placeholder"

    # Apply configuration parsing rules
    model_config = SettingsConfigDict(
        env_file=["backend/.env", ".env"],
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()

