from pydantic_settings import BaseSettings, SettingsConfigDict


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
    CORS_ORIGINS: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    @classmethod
    def assemble_cors_origins(cls, v) -> list[str]:
        import json
        if isinstance(v, str):
            if v.startswith("[") and v.endswith("]"):
                try:
                    return json.loads(v)
                except Exception:
                    pass
            return [x.strip() for x in v.split(",") if x.strip()]
        return v

    # Admin Identity Provider Setup
    ADMIN_EMAIL: str = "admin@voxomate.com"
    ADMIN_PASSWORD: str = "Admin@123"

    # Apply configuration parsing rules
    model_config = SettingsConfigDict(
        env_file=["backend/.env", ".env"],
        env_file_encoding="utf-8",
        extra="ignore",
        json_encoders={list: lambda x: x}
    )

    def __init__(self, **values):
        if "CORS_ORIGINS" in values:
            values["CORS_ORIGINS"] = self.assemble_cors_origins(values["CORS_ORIGINS"])
        elif "cors_origins" in values:
            values["cors_origins"] = self.assemble_cors_origins(values["cors_origins"])
        super().__init__(**values)


settings = Settings()

