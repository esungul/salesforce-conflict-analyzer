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

def get_config() -> Config:
    global _cfg
    if _cfg is not None:
        return _cfg

    _cfg = Config(
        API_MAX_WORKERS=_get_int("API_MAX_WORKERS", 8),
        BITBUCKET_MAX_WORKERS=_get_int("BITBUCKET_MAX_WORKERS", 8),
        BITBUCKET_POOL_MAXSIZE=_get_int("BITBUCKET_POOL_MAXSIZE", 32),
        BITBUCKET_TIMEOUT=_get_float("BITBUCKET_TIMEOUT", 3.0),
        SELF_BASE_URL=os.getenv("SELF_BASE_URL", "http://127.0.0.1:5000"),
        BITBUCKET_BASE_URL=os.getenv("BITBUCKET_BASE_URL"),
        BITBUCKET_TOKEN=os.getenv("BITBUCKET_TOKEN"),
        BITBUCKET_WORKSPACE=os.getenv("BITBUCKET_WORKSPACE"),
        BITBUCKET_REPO_SLUG=os.getenv("BITBUCKET_REPO_SLUG"),
        COMPONENT_TYPES_YAML=os.getenv("COMPONENT_TYPES_YAML"),  # e.g., "component_types.yaml"
    )
    return _cfg
