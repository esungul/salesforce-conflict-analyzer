"""
Adapter that wires multi_compare's backend diffing to your existing git_client.GitClient.
Usage in app.py:
    from multi_compare_adapter import register_compare_v2
    register_compare_v2(app)
"""
from __future__ import annotations
from typing import Dict
from multi_compare import build_blueprint, ComponentSpec
from git_client import BitBucketClient
from git_diff import is_git_available, best_git_diff
def _safe_close(client):
    try:
        if hasattr(client, "close"):
            client.close()
    except Exception:
        pass

def _fetch_component_files(org: str, branch: str, component: ComponentSpec) -> Dict[str, str]:
    """
    Return { "relative/path": "file contents", ... } for a single org+branch+component.
    Strategy:
      1) Try bundle listing: get_bundle_files(name, type, branch) -> [paths]
      2) Fallback to single-file path: build_component_path(name, type)
    """
    client = BitBucketClient()
    try:
        out: Dict[str, str] = {}
        paths = []
        # Prefer bundle files if the method exists and returns something
        if hasattr(client, "get_bundle_files"):
            try:
                paths = client.get_bundle_files(component.name, component.type, branch=branch) or []
            except Exception:
                paths = []
        # Fallback to a single component path
        if not paths and hasattr(client, "build_component_path"):
            try:
                single_path = client.build_component_path(component.name, component.type)
                if single_path:
                    paths = [single_path]
            except Exception:
                pass
        # Read contents
        if hasattr(client, "get_file_content"):
            for p in paths:
                try:
                    content = client.get_file_content(p, branch)
                    if content is not None:
                        out[p] = content
                except Exception:
                    continue
        return out
    finally:
        _safe_close(client)

def _git_diff_provider(path: str, base_branch: str, other_branch: str) -> dict | None:
    """
    Use git-native diff (patience, optional word diff) when available.
    Returns an object suitable for returning directly in files[].diff (as part of 'items').
    """
    client = BitBucketClient()
    try:
        # Detect repo/workdir attribute
        repo_path = None
        for attr in ("repo_path", "workdir", "repo_dir", "root"):
            if hasattr(client, attr):
                repo_path = getattr(client, attr)
                if repo_path:
                    break
        if not repo_path or not is_git_available():
            return None
        # Let git_diff decide best representation
        return best_git_diff(repo_path, base_branch, other_branch, path, context=3, algorithm="patience", mode="auto")
    except Exception:
        return None
    finally:
        _safe_close(client)

def register_compare_v2(app):
    """
    Register /api/compare-orgs-v2 using the GitClient-backed fetcher + git diff provider.
    """
    app.register_blueprint(build_blueprint(fetcher=_fetch_component_files, diff_provider=_git_diff_provider))