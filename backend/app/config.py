from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    secret_key: str = "dev-secret-change-me"
    database_url: str = "sqlite:///./curlhard.db"
    cookie_name: str = "curlhard_session"
    cookie_secure: bool = True
    session_days: int = 30
    allowed_origins: list[str] = []
    rate_limit_per_minute: int = 10
    min_password_length: int = 10


@lru_cache
def get_settings() -> Settings:
    return Settings()
