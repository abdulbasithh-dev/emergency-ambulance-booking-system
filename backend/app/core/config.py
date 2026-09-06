import os
from typing import List
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "ResQ — Emergency Ambulance Tracking & Dispatch Platform"
    TAGLINE: str = "Every Second Matters."
    API_V1_STR: str = "/api"
    
    SECRET_KEY: str = os.getenv("SECRET_KEY", "resq-super-emergency-dispatch-jwt-secret-key-2025")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 24 hours for seamless demo & shifts
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # SQLite async default for zero-friction local execution, PostgreSQL supported via env
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./resq.db")
    
    # CORS Origins
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
        "*"
    ]
    
    # Default Metro Center (Chennai / OMR tech corridor for realistic coordinates)
    DEFAULT_LAT: float = 12.9010
    DEFAULT_LNG: float = 80.2279
    
    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
