import os
from pathlib import Path

# Manual .env loading
env_path = Path(__file__).parent.parent.parent / ".env"
if env_path.exists():
    with open(env_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" in line:
                key, value = line.split("=", 1)
                os.environ[key.strip()] = value.strip().strip('"').strip("'")


class Settings:
    BASE_DIR = Path(__file__).parent.parent.parent
    PROJECTS_DIR = BASE_DIR / "projects"

    # Engine Settings
    DEFAULT_CHUNK_SIZE = int(os.getenv("DEFAULT_CHUNK_SIZE", 800))
    DEFAULT_CHUNK_OVERLAP = int(os.getenv("DEFAULT_CHUNK_OVERLAP", 100))
    DEFAULT_SIMILARITY_THRESHOLD = float(
        os.getenv("DEFAULT_SIMILARITY_THRESHOLD", 0.92)
    )


settings = Settings()

# Ensure projects directory exists
settings.PROJECTS_DIR.mkdir(parents=True, exist_ok=True)
