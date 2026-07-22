import os
from pydantic_settings import BaseSettings


def parse_origins(value: str) -> list[str]:
    return list(dict.fromkeys(origin.strip().rstrip("/") for origin in value.split(",") if origin.strip()))

class Settings(BaseSettings):
    SUPABASE_URL: str
    SUPABASE_SECRET_KEY: str
    SUPABASE_JWT_SECRET: str
    RAZORPAY_KEY_ID: str
    RAZORPAY_SECRET: str
    RESEND_API_KEY: str = ""
    RESEND_FROM_EMAIL: str = ""
    RESEND_REPLY_TO: str = ""
    FRONTEND_URL: str = "http://localhost:5173"
    FRONTEND_URLS: str = ""
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    RELOAD: bool = False

    @property
    def allowed_frontend_origins(self) -> list[str]:
        return parse_origins(self.FRONTEND_URLS or self.FRONTEND_URL)

    class Config:
        env_file = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env")
        extra = "ignore"

settings = Settings()
