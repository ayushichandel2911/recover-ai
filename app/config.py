"""
Central configuration for RecoverAI.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # App
    app_name: str = "RecoverAI"
    app_env: str = "development"

    # API
    api_host: str = "127.0.0.1"
    api_port: int = 8000

    # LLM - used later
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-sonnet-4-6"

    # Razorpay
    razorpay_key_id: str = ""
    razorpay_key_secret: str = ""
    razorpay_webhook_secret: str = ""


    # Reproducibility
    default_random_seed: int = 42

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()