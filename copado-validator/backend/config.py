# config.py
import os
from dataclasses import dataclass

@dataclass(frozen=True)
class Config:
    # Threading / concurrency
    API_MAX_WORKERS: int
    BITBUCKET_MAX_WORKERS: int
    BITBUCKET_POOL_MAXSIZE: int

    # HTTP timeouts (seconds)
    BITBUCKET_TIMEOUT: float

    # Optional: service base URL if your wrapper calls your own server via HTTP
    SELF_BASE_URL: str

    # Optional: Bitbucket base URL, token, workspace/repo (only if you centralize these)
    BITBUCKET_BASE_URL: str | None = None
    BITBUCKET_TOKEN: str | None = None
    BITBUCKET_WORKSPACE: str | None = None
    BITBUCKET_REPO_SLUG: str | None = None

    # Optional: path to component types YAML if you want to move it here
    COMPONENT_TYPES_YAML: str | None = None
    
    # ========== NEW: Validation Configuration ==========
    VALIDATION_ENABLED: bool = True
    VALIDATION_SKIP_LARGE_FILES: bool = True
    VALIDATION_LARGE_FILE_MB: int = 10
    VALIDATION_LEVEL_DEFAULT: str = "standard"
    VALIDATION_LEVEL_CRITICAL: str = "full"


_cfg: Config | None = None

def _get_int(name: str, default: int) -> int:
    try:
        v = int(os.getenv(name, str(default)))
        return v
    except Exception:
        return default

def _get_float(name: str, default: float) -> float:
    try:
        v = float(os.getenv(name, str(default)))
        return v
    except Exception:
        return default

def _get_bool(name: str, default: bool) -> bool:
    """Get boolean from environment variable"""
    value = os.getenv(name, str(default)).lower()
    if value in ('true', '1', 'yes', 'on'):
        return True
    elif value in ('false', '0', 'no', 'off'):
        return False
    return default

def get_config() -> Config:
    global _cfg
    if _cfg is not None:
        return _cfg

    _cfg = Config(
        API_MAX_WORKERS=_get_int("API_MAX_WORKERS", 8),
        BITBUCKET_MAX_WORKERS=_get_int("BITBUCKET_MAX_WORKERS", 8),
        BITBUCKET_POOL_MAXSIZE=_get_int("BITBUCKET_POOL_MAXSIZE", 32),
        BITBUCKET_TIMEOUT=_get_float("BITBUCKET_TIMEOUT", 10.0),
        SELF_BASE_URL=os.getenv("SELF_BASE_URL", "http://127.0.0.1:5000"),
        BITBUCKET_BASE_URL=os.getenv("BITBUCKET_BASE_URL"),
        BITBUCKET_TOKEN=os.getenv("BITBUCKET_TOKEN"),
        BITBUCKET_WORKSPACE=os.getenv("BITBUCKET_WORKSPACE"),
        BITBUCKET_REPO_SLUG=os.getenv("BITBUCKET_REPO_SLUG"),
        COMPONENT_TYPES_YAML=os.getenv("COMPONENT_TYPES_YAML"),  # e.g., "component_types.yaml"
        VALIDATION_ENABLED=_get_bool("VALIDATION_ENABLED", True),
        VALIDATION_SKIP_LARGE_FILES=_get_bool("VALIDATION_SKIP_LARGE_FILES", True),
        VALIDATION_LARGE_FILE_MB=_get_int("VALIDATION_LARGE_FILE_MB", 10),
        VALIDATION_LEVEL_DEFAULT=os.getenv("VALIDATION_LEVEL_DEFAULT", "standard"),
        VALIDATION_LEVEL_CRITICAL=os.getenv("VALIDATION_LEVEL_CRITICAL", "full"),
        )
    return _cfg
