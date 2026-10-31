"""
Brightloop — Pydantic settings.

Reads from environment variables or a local .env file (never committed).
Variable names must match .env.example and the Supabase project configuration.
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration validated at startup."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",  # ignore unrecognised env vars
    )

    # ---------------------------------------------------------------------------
    # Application
    # ---------------------------------------------------------------------------
    app_name: str = "Brightloop"
    app_version: str = "0.1.0"
    debug: bool = False

    # Allowed origins for CORS — comma-separated list supplied via env.
    # Default allows local Vite dev server only; override in production.
    cors_origins: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    # ---------------------------------------------------------------------------
    # Supabase (all required for a connected instance; optional for local testing)
    # ---------------------------------------------------------------------------
    supabase_url: str = ""
    supabase_anon_key: str = ""
    # Service-role key is server-only; keep out of browser bundles and logs.
    supabase_service_role_key: str = ""

    # ---------------------------------------------------------------------------
    # AI integration (optional; added only when AI assistant is implemented)
    # ---------------------------------------------------------------------------
    ai_provider_api_key: str = ""


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return the singleton Settings instance (loaded once, cached)."""
    return Settings()

