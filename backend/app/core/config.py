import os
from dotenv import load_dotenv
from pydantic import BaseModel


load_dotenv()


class Settings(BaseModel):
    app_name: str = "GateKeeper"
    environment: str = os.getenv("ENV", "dev")
    redis_url: str = os.getenv("REDIS_URL", "redis://localhost:6379/0")
    database_url: str = os.getenv("DATABASE_URL", "postgresql://kushkapadia@localhost:5432/gatekeeper")
    policy_version: str = os.getenv("POLICY_VERSION", "v0")


settings = Settings()


