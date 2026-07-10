from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    # Database
    DATABASE_URL: str = "mysql+aiomysql://root:password@localhost:3306/voxomate"

    # JWT
    SECRET_KEY: str = "CHANGE_ME_IN_PRODUCTION_VERY_LONG_SECRET"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 8  # 8h working day

    # App
    APP_TITLE: str = "VoxoMate CRM"
    APP_VERSION: str = "1.0.0"
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000"]


settings = Settings()
