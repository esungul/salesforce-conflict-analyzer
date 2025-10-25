"""
Multi-org comparison utilities + Flask blueprint (v2).

- Supports 2-4 orgs in a single request.
- Computes diffs on the backend (unified by default), with optional git-backed provider.
- Additive to your app: exposes POST /api/compare-orgs-v2

Author: ChatGPT
"""
from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Dict, List, Optional, Tuple, Callable
from collections import defaultdict
import hashlib
import time
import difflib
import logging

logger = logging.getLogger(__name__)

# ----------------------------
# Types
# ----------------------------

@dataclass
class OrgSpec:
    org: str
    branch: str

@dataclass
class ComponentSpec:
    type: str
    name: str

@dataclass
class FileVersion:
    # A single file's content for one org
    exists: bool
    content: str | None
    sha256: str | None
    line_count: int | None

@dataclass
class ComponentResult:
    type: str
    name: str
    files: List[Dict]
    summary: Dict

# ----------------------------
# Utilities
# ----------------------------

def _sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8", "ignore")).hexdigest()

def _to_lines(text: str) -> List[str]:
    if text is None:
        return []
    return text.splitlines(keepends=True)

def _compact_unified_diff(a_lines: List[str], b_lines: List[str], file_label_a: str, file_label_b: str, n: int = 3) -> List[Dict]:
    """
    Return a compact representation of unified diff hunks for UI consumption.
    Each hunk dict has: header, lines (with leading ' ', '+', '-')
    """
    udiff = difflib.unified_diff(a_lines, b_lines, fromfile=file_label_a, tofile=file_label_b, n=n)
    hunks: List[Dict] = []
    cur_hunk = {"header": "", "lines": []}
    for line in udiff:
        if line.startswith("@@"):
            if cur_hunk["lines"]:
                hunks.append(cur_hunk)
                cur_hunk = {"header": "", "lines": []}
            cur_hunk["header"] = line.rstrip("\n")
        else:
            cur_hunk["lines"].append(line.rstrip("\n"))
    if cur_hunk["header"] or cur_hunk["lines"]:
        hunks.append(cur_hunk)
    return hunks

# ----------------------------
# Fetcher Abstraction
# ----------------------------

def default_fetcher(org: str, branch: str, component: ComponentSpec) -> Dict[str, str]:
    """
    Placeholder fetcher. Replace its body to call your git_client to fetch
    the bundle/single-file set for (org, branch, component).

    Must return: { "relative/path.ext": "file contents", ... }
    For missing component/files, return {}.
    """
    return {}

# ----------------------------
# Core logic
# ----------------------------

def compute_file_matrix(
    orgs: List[OrgSpec],
    component: ComponentSpec,
    fetcher: Callable[[str, str, ComponentSpec], Dict[str, str]],
) -> Tuple[List[str], List[List[FileVersion]]]:
    """
    Build a matrix: rows = files (union across orgs), cols = orgs
    Returns: (file_paths, matrix)
    """
    per_org_files: List[Dict[str, str]] = []
    all_paths = set()

    for o in orgs:
        files = fetcher(o.org, o.branch, component) or {}
        per_org_files.append(files)
        all_paths.update(files.keys())

    file_paths = sorted(all_paths)
    matrix: List[List[FileVersion]] = []
    for path in file_paths:
        row: List[FileVersion] = []
        for idx, o in enumerate(orgs):
            content = per_org_files[idx].get(path)
            if content is None:
                row.append(FileVersion(False, None, None, None))
            else:
                row.append(FileVersion(True, content, _sha256(content), len(content.splitlines())))
        matrix.append(row)
    return file_paths, matrix

def _classify_row(row: List[FileVersion]) -> str:
    exists_flags = [c.exists for c in row]
    if all(not f for f in exists_flags):
        return "MISSING"
    existing = [c for c in row if c.exists]
    if len(existing) == 1:
        return "NEW"
    hashes = [c.sha256 for c in existing]
    if len(set(hashes)) == 1:
        return "ALL_SAME"
    return "DIFF"

def compute_component_diff(
    orgs: List[OrgSpec],
    component: ComponentSpec,
    fetcher: Callable[[str, str, ComponentSpec], Dict[str, str]],
    include_diffs: bool,
    diff_base_org: Optional[str] = None,
    changed_only: bool = False,
    unified_context: int = 3,
    diff_provider: Optional[Callable[[str, str, str], dict | None]] = None,
) -> ComponentResult:
    """
    Compute file-level multi-org diff for a single component.
    diff_provider(path, base_branch, other_branch) -> optional git-backed diff object.
    """
    file_paths, matrix = compute_file_matrix(orgs, component, fetcher)

    # Pick base org
    base_idx = 0
    if diff_base_org:
        for i, o in enumerate(orgs):
            if o.org == diff_base_org:
                base_idx = i
                break

    files_out: List[Dict] = []
    files_changed = 0

    for i, path in enumerate(file_paths):
        row = matrix[i]
        status = _classify_row(row)

        per_org_meta = []
        for j, o in enumerate(orgs):
            fv = row[j]
            per_org_meta.append({
                "org": o.org,
                "branch": o.branch,
                "exists": fv.exists,
                "sha256": fv.sha256,
                "line_count": fv.line_count
            })

        unified_hunks = None
        if include_diffs and status in ("DIFF", "NEW"):
            hunks_all: List[Dict] = []
            base_txt = row[base_idx].content or ""
            base_branch = orgs[base_idx].branch

            # Compare each non-base org to the base
            for j, o in enumerate(orgs):
                if j == base_idx:
                    continue

                # Skip if identical
                if row[j].sha256 == row[base_idx].sha256:
                    continue

                other_txt = row[j].content or ""

                # (1) Prefer git-native diff if provider available and both exist
                git_obj = None
                if diff_provider and row[j].exists and row[base_idx].exists:
                    try:
                        git_obj = diff_provider(path, base_branch, o.branch)
                    except Exception:
                        git_obj = None

                if git_obj:
                    # Single object per comparison (UI can switch on 'format')
                    hunks_all.append(git_obj)
                else:
                    # (2) Fallback to compact unified diff over content
                    base_lines = _to_lines(base_txt)
                    other_lines = _to_lines(other_txt)
                    hunks = _compact_unified_diff(
                        base_lines, other_lines,
                        f"{orgs[base_idx].org}:{base_branch}:{path}",
                        f"{o.org}:{o.branch}:{path}",
                        n=unified_context
                    )
                    hunks_all.extend(hunks)

            if hunks_all:
                unified_hunks = hunks_all

        if status in ("DIFF", "NEW"):
            files_changed += 1

        if (not changed_only) or (status in ("DIFF", "NEW")):
            files_out.append({
                "path": path,
                "status": status,
                "base_org": orgs[base_idx].org,
                "per_org_meta": per_org_meta,
                "diff": unified_hunks and {"format": "mixed", "items": unified_hunks} or None
            })

    summary = {
        "files_total": len(file_paths),
        "files_changed": files_changed,
        "files_unchanged": len(file_paths) - files_changed,
    }

    return ComponentResult(
        type=component.type,
        name=component.name,
        files=files_out,
        summary=summary
    )

# ----------------------------
# Flask Blueprint
# ----------------------------

def build_blueprint(
    fetcher: Callable[[str, str, ComponentSpec], Dict[str, str]] = default_fetcher,
    diff_provider: Callable[[str, str, str], dict | None] | None = None
):
    """
    Returns a Flask Blueprint exposing POST /api/compare-orgs-v2
    """
    from flask import Blueprint, request, jsonify

    bp = Blueprint("compare_orgs_v2", __name__)

    @bp.route("/api/compare-orgs-v2", methods=["POST"])
    def compare_orgs_v2():
        """
        Request body:
        {
          "orgs": [{"org":"QA","branch":"qa"}, {"org":"Prod","branch":"master"}, ...],  # 2..4
          "components": [{"type":"ApexClass","name":"Foo"}],
          "include_diffs": true,
          "changed_only": false,
          "diff_base_org": "Prod",
          "unified_context": 3
        }
        """
        t_start = time.time()
        body = request.get_json(force=True, silent=True) or {}

        # Back-compat shim for orgA/orgB
        if "orgs" not in body and "orgA" in body and "orgB" in body:
            orgs = [
                {"org": body.get("orgA"), "branch": body.get("branchA")},
                {"org": body.get("orgB"), "branch": body.get("branchB")}
            ]
        else:
            orgs = body.get("orgs") or []

        if not (2 <= len(orgs) <= 4):
            return jsonify({"error": "Provide between 2 and 4 orgs."}), 400

        org_specs = [OrgSpec(o["org"], o["branch"]) for o in orgs]

        components = body.get("components") or []
        comp_specs = [ComponentSpec(c["type"], c["name"]) for c in components]

        include_diffs = bool(body.get("include_diffs", False))
        changed_only = bool(body.get("changed_only", False))
        diff_base_org = body.get("diff_base_org")
        unified_context = int(body.get("unified_context", 3))

        results: List[ComponentResult] = []
        for comp in comp_specs:
            result = compute_component_diff(
                org_specs, comp, fetcher,
                include_diffs=include_diffs,
                diff_base_org=diff_base_org,
                changed_only=changed_only,
                unified_context=unified_context,
                diff_provider=diff_provider
            )
            results.append(result)

        out = {
            "meta": {
                "orgs": [asdict(o) for o in org_specs],
                "include_diffs": include_diffs,
                "changed_only": changed_only,
                "diff_base_org": diff_base_org or org_specs[0].org,
                "unified_context": unified_context,
                "version": "v2"
            },
            "components": [
                {
                    "type": r.type,
                    "name": r.name,
                    "files": r.files,
                    "summary": r.summary
                } for r in results
            ],
            "perf": {
                "components": len(results),
                "total_ms": int((time.time() - t_start) * 1000)
            }
        }
        return jsonify(out), 200

    return bp