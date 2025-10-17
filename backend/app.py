"""
Flask REST API for Copado Deployment Validator

Endpoints:
  POST /api/analyze - Upload CSV and get conflict analysis
  GET  /api/health  - Health check
"""
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.utils import secure_filename
import os
import tempfile
from csv_parser import CopadoCSVParser
from conflict_detector import ConflictDetector
from models import ConflictSeverity
from pdf_generator import generate_pdf_report
from flask import send_file
from production_analyzer import parse_production_state, check_regression
from git_client import BitBucketClient 
from concurrent.futures import ThreadPoolExecutor, as_completed
from config import get_config
from typing import Optional, Tuple
from sf_adapter import sf_records_to_rows
import csv
from tempfile import NamedTemporaryFile
from salesforce_client import (
    sf_login_from_config,
    fetch_user_story_metadata_by_release,
    fetch_user_story_metadata_by_story_names,
)


import logging
logging.basicConfig(level=logging.INFO)  # put once (e.g., in app.py main)
logger = logging.getLogger(__name__)



# Initialize Flask app
app = Flask(__name__)
CORS(app)  # Allow frontend to call this API

# Configuration
UPLOAD_FOLDER = tempfile.gettempdir()
ALLOWED_EXTENSIONS = {'csv'}

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size


def allowed_file(filename):
    """Check if file extension is allowed"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

from pdf_generator import generate_pdf_report
from flask import send_file



# === Component History Wrapper API ===
# Returns last N commit IDs (and metadata) for each component on each org/branch.
from flask import request, jsonify
import component_registry as cr
from git_client import BitBucketClient

















# ====== BEGIN PATCH: Compare & History Wrapper APIs ======
from flask import request, jsonify
import component_registry as cr
from git_client import BitBucketClient

from enum import Enum
from datetime import datetime, date


# ---------------- Helpers ----------------

##########

  




def json_safe(obj):
    """Recursively convert objects to JSON-serializable types."""
    # Enums → use name (or .value if you prefer)
    if isinstance(obj, Enum):
        return obj.name  # or obj.value

    # Datetime/Date → ISO-8601 strings
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()

    # Sets/Tuples → lists
    if isinstance(obj, (set, tuple)):
        return [json_safe(x) for x in obj]

    # Dict → recurse
    if isinstance(obj, dict):
        return {k: json_safe(v) for k, v in obj.items()}

    # Lists → recurse
    if isinstance(obj, list):
        return [json_safe(x) for x in obj]

    # Model-like objects → try to_dict(), else __dict__
    if hasattr(obj, "to_dict") and callable(getattr(obj, "to_dict")):
        return json_safe(obj.to_dict())
    if hasattr(obj, "__dict__"):
        # filter out private attrs
        return {k: json_safe(v) for k, v in obj.__dict__.items() if not k.startswith("_")}

    # Bytes → utf-8
    if isinstance(obj, (bytes, bytearray)):
        try:
            return obj.decode("utf-8")
        except Exception:
            return str(obj)

    # Fallback: leave primitives as-is
    return obj


def _strip_type_prefix(ctype: str, cname: str) -> str:
    """Normalize 'Type.Name' → 'Name' when prefix matches the type."""
    if not ctype or not cname:
        return cname
    prefix = f"{ctype}."

    return cname[len(prefix):] if cname.startswith(prefix) else cname


def _pick_primary_file_for_bundle(gclient: BitBucketClient, branch: str, folder: str, ctype: str, cname: str) -> str | None:
    """
    Pick a representative file from a bundle folder:
      1) If registry defines primary_glob (e.g. '{name}/{name}_DataPack.json'), use '<folder>/<tail>'
      2) Else prefer '*_DataPack.json' in the folder
      3) Else prefer any '.json'
      4) Else first file
    """
    ti = cr.get_type_info(ctype) or {}
    primary_glob = ti.get("primary_glob")
    if primary_glob:
        # Glob may contain a subfolder "{name}/..."; keep only filename tail to safely join.
        tail = primary_glob.replace("{name}", cname).split("/", 1)[-1]
        return f"{folder.rstrip('/')}/{tail}"

    files = gclient.list_folder_files(folder, branch=branch) or []
    if not files:
        return None
    # Prefer datapacks
    for p in files:
        if isinstance(p, str) and p.lower().endswith("_datapack.json"):
            return p
    # Then any json
    for p in files:
        if isinstance(p, str) and p.lower().endswith(".json"):
            return p
    # Fallback: first string path
    for p in files:
        if isinstance(p, str):
            return p
    return None



def _call_internal_endpoint(path: str, payload: dict) -> dict:
    """
    Reuse existing Flask endpoints without an HTTP roundtrip.
    """
    with app.test_client() as c:
        resp = c.post(path, json=payload)
        try:
            data = resp.get_json() or {}
        except Exception:
            data = {"success": False, "error": f"Invalid JSON from {path}"}
        if "success" not in data:
            data["success"] = (200 <= resp.status_code < 300)
        data["_status_code"] = resp.status_code
        return data


def _normalize_name(ctype: str, cname: str) -> str:
    """
    Strip 'Type.' prefix from the component name if it matches the type.
    Example: ('CustomMetadata', 'CustomMetadata.Foo.Bar') -> 'Foo.Bar'
    """
    if not ctype or not cname:
        return cname
    prefix = f"{ctype}."
    return cname[len(prefix):] if cname.startswith(prefix) else cname


def _as_str_path(folder_any) -> str | None:
    """
    Normalize resolve_vlocity_bundle return value into a string path.
    Accepts str, list/tuple of strs, or dict with common keys.
    """
    if folder_any is None:
        return None
    if isinstance(folder_any, str):
        return folder_any
    if isinstance(folder_any, (list, tuple)):
        for v in folder_any:
            if isinstance(v, str):
                return v
        return None
    if isinstance(folder_any, dict):
        for k in ("folder", "path", "dir", "component_folder"):
            v = folder_any.get(k)
            if isinstance(v, str):
                return v
        for v in folder_any.values():
            if isinstance(v, str):
                return v
        return None
    return None


def _pick_primary_file_in_bundle(client: BitBucketClient, branch: str, folder_any, ctype: str, cname: str) -> str | None:
    """
    Choose a single representative file within a bundle folder.

    Strategy:
      1) If registry defines primary_glob (e.g. "{name}/{name}_DataPack.json"),
         build "<resolved_folder>/<tail_from_glob>".
      2) Else list folder and pick:
         - *_DataPack.json
         - else any .json
         - else the first file.
    """
    folder = _as_str_path(folder_any)
    if not folder:
        return None

    ti = cr.get_type_info(ctype) or {}
    primary_glob = ti.get("primary_glob")

    if primary_glob:
        base = cname  # registry has already normalized the folder; use given name
        # If the glob contains a subfolder, keep only the filename part to join safely.
        try:
            tail = primary_glob.replace("{name}", base).split("/", 1)[-1]
        except Exception:
            tail = f"{base}_DataPack.json"
        return f"{folder.rstrip('/')}/{tail}"

    files = client.list_folder_files(folder, branch=branch) or []
    if not files:
        return None

    datapacks = [p for p in files if isinstance(p, str) and p.lower().endswith("_datapack.json")]
    if datapacks:
        return datapacks[0]

    jsons = [p for p in files if isinstance(p, str) and p.lower().endswith(".json")]
    if jsons:
        return jsons[0]

    for p in files:
        if isinstance(p, str):
            return p
    return None


def _resolve_primary_file_for_component(client: BitBucketClient, branch: str, ctype: str, cname: str) -> str | None:
    """
    Resolve a single file path representing the component:
      - bundle: resolve folder then pick a primary datapack file (fast)
      - single-file: resolve via get_file_content_smart to obtain file path
    """
    if cr.is_bundle(ctype):
        folder_any = client.resolve_vlocity_bundle(branch=branch, component_type=ctype, component_name=cname)
        if not folder_any:
            return None
        return _pick_primary_file_in_bundle(client, branch, folder_any, ctype, cname)

    _content, path = client.get_file_content_smart(component_name=cname, component_type=ctype, branch=branch)
    return path





# ===== /api/compare-commits (fast, diffstat-based component change summary) =====


# =============== /api/compare-commits (fast, diffstat-based, timeout-safe) ===============
from flask import request, jsonify
from git_client import BitBucketClient
import component_registry as cr
from urllib.parse import unquote
from requests.exceptions import ReadTimeout, ConnectionError
from config import get_config








@app.route('/api/analyze-sf', methods=['POST'])
def analyze_salesforce_stub():
    """
    Online path: validate input -> fetch from Salesforce -> adapt to rows ->
    write a CSV we can inspect -> reuse existing CSV parser -> detect conflicts.
    """
    payload = request.get_json(force=True, silent=True) or {}

    # Normalize inputs
    release_names = payload.get("releaseNames")
    if isinstance(release_names, str):
        release_names = [rn.strip() for rn in release_names.split(",") if rn.strip()] or [release_names]

    story_names = payload.get("userStoryNames")
    if isinstance(story_names, str):
        story_names = [sn.strip() for sn in story_names.split(",") if sn.strip()] or [story_names]

    if not release_names and not story_names:
        return jsonify({"error": "Provide releaseNames or userStoryNames"}), 400
    if release_names and not isinstance(release_names, list):
        return jsonify({"error": "releaseNames must be a string or an array of strings"}), 400
    if story_names and not isinstance(story_names, list):
        return jsonify({"error": "userStoryNames must be a string or an array of strings"}), 400

    # --- Salesforce fetch ---
    try:
        sf = sf_login_from_config(payload.get("configJsonPath"))
        if release_names:
            records = fetch_user_story_metadata_by_release(sf, release_names)
        else:
            records = fetch_user_story_metadata_by_story_names(sf, story_names)
    except Exception as e:
        # Auth or query error
        return jsonify({"error": str(e)}), 401

    # Adapt SF JSON -> "rows" with the same headers as your CSV
    rows = sf_records_to_rows(records)

    # No data? Return empty in the same shape
    if not rows:
        return jsonify({
            "summary": {
                "stories": 0, "components": 0,
                "component_conflicts": 0, "story_conflicts": 0
            },
            "component_conflicts": [],
            "story_conflicts": []
        }), 200

    # --- Write CSV to a visible folder so you can inspect it ---
    os.makedirs("./tmp/online_inputs", exist_ok=True)
    header = list(rows[0].keys())
    # Use a friendly prefix (release or stories)
    pref = "release" if release_names else "stories"
    with NamedTemporaryFile(
        mode="w+", newline="", suffix=".csv", prefix=f"{pref}_", dir="./tmp/online_inputs", delete=False
    ) as tmp:
        writer = csv.DictWriter(tmp, fieldnames=header, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)
        tmp_path = tmp.name  # keep this file for inspection

    # --- Reuse your existing CSV pipeline ---
    parser = CopadoCSVParser()
    parsed = parser.parse_file(tmp_path)  # your parser's method

    # IMPORTANT: ConflictDetector requires user_stories in __init__
    detector = ConflictDetector(parsed.user_stories)

    # Component-level conflicts (touching the same component)
    # Your ConflictDetector exposes a public method named 'detect_conflicts'
    # which returns component conflict objects; we’ll serialize them as dicts if needed.
    component_conflicts = detector.detect_conflicts()

    # Story-to-story conflicts (pairs/groups of stories conflicting across multiple components)
    story_conflicts = detector.analyze_story_to_story_conflicts()

    # Summaries (optional but nice to include)
    summary = detector.get_conflict_summary(component_conflicts) if hasattr(detector, "get_conflict_summary") else {
        "total_conflicts": len(component_conflicts),
        "severity_breakdown": {},  # provide if you have it
        "affected_stories": 0,
        "avg_risk_score": 0
    }

    # If component_conflicts are model objects, convert to dicts
    def _asdict(x):
        if isinstance(x, dict):
            return x
        if hasattr(x, "__dict__"):
            return {k: v for k, v in x.__dict__.items() if not k.startswith("_")}
        return x

    component_conflicts_out = [_asdict(c) for c in component_conflicts]
    story_conflicts_out = [dict(sc) if not isinstance(sc, dict) else sc for sc in story_conflicts]
    component_conflicts_out = json_safe(component_conflicts)
    story_conflicts_out = json_safe(story_conflicts)
    summary_out = json_safe(summary)
    
    return jsonify({
    "summary": {
        "stories": len(parsed.user_stories),
        "components": len(parsed.components),
        "component_conflicts": len(component_conflicts_out),
        "story_conflicts": len(story_conflicts_out),
        "detail": summary_out
    },
    "component_conflicts": component_conflicts_out,
    "story_conflicts": story_conflicts_out,
    "debug_csv_path": tmp_path
}), 200

# ---------------- Wrapper 1: Compare Orgs (summary + optional diffs) ----------------

@app.route('/api/compare-orgs', methods=['POST'])
def compare_orgs():
    """
    Compare latest commits of components between two orgs/branches by reusing:
      - /api/production-state
      - /api/get-code-diff   (only when include_diffs=true for changed items)

    Request JSON:
    {
      "orgA": "uat",
      "orgB": "prod",
      "branchA": "uatsfdc",
      "branchB": "master",
      "components": [ {"type":"DataRaptor","name":"PRDRFetchAssets"}, ... ],
      "include_diffs": false,
      "changed_only": false,
      "limit": null
    }
    """
    data = request.get_json(silent=True) or {}
    base_url = get_config().SELF_BASE_URL


    orgA = (data.get("orgA") or "uat").strip()
    orgB = (data.get("orgB") or "prod").strip()
    branchA = (data.get("branchA") or data.get("uat_branch") or "uatsfdc").strip()
    branchB = (data.get("branchB") or data.get("prod_branch") or "master").strip()

    components = data.get("components") or []
    include_diffs = bool(data.get("include_diffs", False))
    changed_only = bool(data.get("changed_only", False))
    limit = data.get("limit", None)
    try:
        limit = int(limit) if limit is not None else None
    except Exception:
        limit = None

    if not components:
        return jsonify({"success": False, "error": "components list is required"}), 400

    # Normalize incoming + de-duplicate by (type, normalized name)
    raw = []
    for comp in components:
        ctype = comp.get("type") or comp.get("component_type")
        cname_in = comp.get("name") or comp.get("component_name")
        if not ctype or not cname_in:
            return jsonify({"success": False, "error": f"Bad component entry: {comp}"}), 400
        raw.append({"type": ctype, "name": _normalize_name(ctype, cname_in)})

    seen = set()
    norm_components = []
    for comp in raw:
        key = (comp["type"], comp["name"])
        if key in seen:
            app.logger.debug(f"[compare-orgs] duplicate component ignored: {key}")
            continue
        seen.add(key)
        norm_components.append(comp)

    # Reuse production-state for both sides
    payloadA = {"branch": branchA, "components": norm_components}
    payloadB = {"branch": branchB, "components": norm_components}

    stateA = _call_internal_endpoint("/api/production-state", payloadA)
    stateB = _call_internal_endpoint("/api/production-state", payloadB)

    if not stateA.get("success"):
        return jsonify({"success": False,
                        "error": f"/api/production-state failed for orgA ({branchA})",
                        "details": stateA}), 502
    if not stateB.get("success"):
        return jsonify({"success": False,
                        "error": f"/api/production-state failed for orgB ({branchB})",
                        "details": stateB}), 502

    listA = stateA.get("production_state", []) or []
    listB = stateB.get("production_state", []) or []

    # Index rows by (type, normalized name) → {commit, exists}
    def _index_by_key(rows):
        idx = {}
        for r in rows:
            ctype = r.get("component_type") or r.get("type")
            raw_name = r.get("component_name") or r.get("name")
            cname = _normalize_name(ctype, raw_name)
            commit = (
                r.get("last_commit_hash")      # canonical per your sample
                or r.get("latest_commit")      # fallback
                or r.get("commit")             # defensive
            )
            exists = bool(
                r.get("exists_in_prod")        # canonical per your sample
                or r.get("exists")             # fallback
            )
            idx[(ctype, cname)] = {"commit": commit, "exists": exists}
        return idx

    idxA = _index_by_key(listA)
    idxB = _index_by_key(listB)

    # Compare
    changes_all = []
    counts = {"DIFF": 0, "SAME": 0, "NEW_IN_A": 0, "NEW_IN_B": 0, "NOT_FOUND": 0}

    for comp in norm_components:
        ctype, cname = comp["type"], comp["name"]
        a = idxA.get((ctype, cname), {"commit": None, "exists": False})
        b = idxB.get((ctype, cname), {"commit": None, "exists": False})

        if not a["exists"] and not b["exists"]:
            status = "NOT_FOUND"
            counts["NOT_FOUND"] += 1
        elif a["exists"] and not b["exists"]:
            status = "NEW_IN_A"
            counts["NEW_IN_A"] += 1
        elif b["exists"] and not a["exists"]:
            status = "NEW_IN_B"
            counts["NEW_IN_B"] += 1
        else:
            status = "SAME" if (a["commit"] == b["commit"]) else "DIFF"
            counts["SAME" if status == "SAME" else "DIFF"] += 1

        changes_all.append({
            "component_type": ctype,
            "component_name": cname,
            "commitA": a["commit"],
            "commitB": b["commit"],
            "status": status
        })

    # Optionally filter to changed-only
    changes = [r for r in changes_all if r["status"] in ("DIFF", "NEW_IN_A", "NEW_IN_B")] if changed_only else changes_all

    summary = {
        "total": len(norm_components),
        "changed": counts["DIFF"] + counts["NEW_IN_A"] + counts["NEW_IN_B"],
        "same": counts["SAME"],
        "not_found": counts["NOT_FOUND"]
    }

    # Optionally attach diffs (lazy & limited)
    if include_diffs:
        changed_rows = [row for row in changes if row["status"] in ("DIFF", "NEW_IN_A", "NEW_IN_B")]
        if limit is not None and limit >= 0:
            changed_rows = changed_rows[:limit]
        keys_for_diff = {(r["component_type"], r["component_name"]) for r in changed_rows}

        detailed = []
        for row in changes:
            if (row["component_type"], row["component_name"]) in keys_for_diff:
                diff_payload = {
                    "component_type": row["component_type"],
                    "component_name": row["component_name"],
                    "uat_branch": branchA,   # orgA
                    "prod_branch": branchB   # orgB
                }
                diff_res = _call_internal_endpoint("/api/get-code-diff", diff_payload)
                detailed.append({**row, "diff": diff_res})
            else:
                detailed.append(row)
        changes = detailed

    return jsonify({
        "success": True,
        "orgA": {"name": orgA, "branch": branchA},
        "orgB": {"name": orgB, "branch": branchB},
        "summary": summary,
        "changes": changes
    })


# ---------------- Wrapper 2: Component History (last N commits per org) ----------------

@app.route('/api/component-history', methods=['POST'])
def component_history():
    """
    Return last N commits for each component on both orgs/branches.

    Request JSON:
    {
      "orgA": "uat",
      "orgB": "prod",
      "branchA": "uatsfdc",
      "branchB": "master",
      "components": [
        {"type":"DataRaptor","name":"PRDRFetchAssets"},
        {"type":"IntegrationProcedure","name":"PR_ServiceTabSourceIP"}
      ],
      "limit": 5
    }
    """
    data = request.get_json(silent=True) or {}

    orgA = (data.get("orgA") or "uat").strip()
    orgB = (data.get("orgB") or "prod").strip()
    branchA = (data.get("branchA") or data.get("uat_branch") or "uatsfdc").strip()
    branchB = (data.get("branchB") or data.get("prod_branch") or "master").strip()
    components = data.get("components") or []

    limit = data.get("limit", 5)
    try:
        limit = int(limit)
    except Exception:
        limit = 5

    if not components:
        return jsonify({"success": False, "error": "components list is required"}), 400

    # Normalize + de-duplicate
    raw = []
    for comp in components:
        ctype = comp.get("type") or comp.get("component_type")
        cname = comp.get("name") or comp.get("component_name")
        if not ctype or not cname:
            return jsonify({"success": False, "error": f"Bad component entry: {comp}"}), 400
        raw.append({"type": ctype, "name": _normalize_name(ctype, cname)})

    seen = set()
    norm_components = []
    for c in raw:
        key = (c["type"], c["name"])
        if key in seen:
            continue
        seen.add(key)
        norm_components.append(c)

    client = BitBucketClient(app.logger)

    def _compact(commits):
        compact = []
        for d in commits or []:
            compact.append({
                "hash": d.get("hash") or d.get("id") or d.get("commit"),
                "date": d.get("date") or d.get("date_iso") or d.get("timestamp"),
                "author": d.get("author") or d.get("authorName") or d.get("author_name"),
                "message": d.get("message") or d.get("summary") or d.get("title")
            })
        return compact

    out_rows = []
    for comp in norm_components:
        ctype, cname = comp["type"], comp["name"]

        pathA = _resolve_primary_file_for_component(client, branchA, ctype, cname)
        pathB = _resolve_primary_file_for_component(client, branchB, ctype, cname)

        commitsA = client.get_file_commits(pathA, branch=branchA, limit=limit) if pathA else []
        commitsB = client.get_file_commits(pathB, branch=branchB, limit=limit) if pathB else []

        out_rows.append({
            "component_type": ctype,
            "component_name": cname,
            "orgA": {
                "exists": bool(pathA),
                "file_path": pathA,
                "commits": _compact(commitsA)
            },
            "orgB": {
                "exists": bool(pathB),
                "file_path": pathB,
                "commits": _compact(commitsB)
            }
        })

    return jsonify({
        "success": True,
        "orgA": {"name": orgA, "branch": branchA},
        "orgB": {"name": orgB, "branch": branchB},
        "limit": limit,
        "history": out_rows
    })
# ====== END PATCH ======






@app.route('/api/component-diff-details', methods=['POST'])
def get_component_diff_details():
    """
    Get detailed diff showing which files changed in a component
    """
    try:
        data = request.json
        component_name = data.get('component_name', '')
        component_type = data.get('component_type', '')
        branch1 = data.get('branch1', 'master')
        branch2 = data.get('branch2', 'uatsfdc')
        
        if '.' in component_name:
            component_name = component_name.split('.', 1)[1]
        
        git_client = BitBucketClient()
        
        diff_details = git_client.get_component_diff_details(
            component_name,
            component_type,
            branch1,
            branch2
        )
        
        return jsonify({
            'success': True,
            'diff_details': diff_details
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/check-commit-relationship', methods=['POST'])
def check_commit_relationship():
    """
    Check if one commit includes another's changes
    """
    try:
        data = request.json
        commit1 = data.get('commit1', '')  # Older
        commit2 = data.get('commit2', '')  # Newer
        
        if not commit1 or not commit2:
            return jsonify({
                'success': False,
                'error': 'Both commits required'
            }), 400
        
        git_client = BitBucketClient()
        result = git_client.check_commit_ancestry(commit1, commit2)
        
        return jsonify(result)
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/get-code-diff', methods=['POST'])
def get_code_diff():
    try:
        data = request.json
        component_name = data.get('component_name', '')
        component_type = data.get('component_type', '')
        prod_branch = data.get('prod_branch', 'master')
        uat_branch = data.get('uat_branch', 'uatsfdc')
        
        if '.' in component_name:
            component_name = component_name.split('.', 1)[1]
        
        git_client = BitBucketClient()
        
        # Use bundle diff for multi-file components
        diff_result = git_client.get_bundle_diff(
            component_name=component_name,
            component_type=component_type,
            prod_branch=prod_branch,
            uat_branch=uat_branch
        )
        
        return jsonify({
            'success': True,
            'data': diff_result
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/export-pdf', methods=['POST'])
def export_pdf():
    """Generate and download PDF report"""
    try:
        # Get analysis data from request
        data = request.get_json()
        group_by_dev = data.get('group_by_developer', False)
        
        # Generate PDF
        pdf_file = generate_pdf_report(data, group_by_developer=group_by_dev)
        
        # Return PDF file
        filename = f"copado_analysis_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
        
        return send_file(
            pdf_file,
            mimetype='application/pdf',
            as_attachment=True,
            download_name=filename
        )
    
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    """
    Health check endpoint
    
    Returns:
        JSON with status
    """
    return jsonify({
        'status': 'healthy',
        'service': 'Copado Deployment Validator API',
        'version': '1.0.0'
    })


@app.route('/api/production-state', methods=['POST'])
   

def get_production_state():
    cfg = get_config()
    max_workers = int(cfg.API_MAX_WORKERS)
    """
    Request JSON:
    {
      "branch": "master",
      "components": [ {"type":"DataRaptor","name":"PR_GetStoreDetails"}, ... ]
    }

    Response JSON (shape preserved):
    {
      "success": true,
      "branch": "master",
      "checked_at": "ISO8601",
      "total_components": N,
      "existing": X,
      "missing": Y,
      "production_state": [
        {
          "component_name": "CustomMetadata.PR_Generic.OLSPForUSMainlandNumber",
          "component_type": "CustomMetadata",
          "exists_in_prod": true,
          "file_path": "customMetadata/PR_Generic.OLSPForUSMainlandNumber.md",
          "file_size": 1460,
          "last_author": "...",
          "last_commit_date": "2025-09-22T13:49:26+00:00",
          "last_commit_hash": "acbb0e9c",
          "last_commit_message": "..."
        },
        ...
      ]
    }
    """
    body = request.get_json(silent=True) or {}
    branch = (body.get('branch') or body.get('prod_branch') or 'master').strip()
    components = body.get('components') or []

    app.logger.info("get_production_state 1: branch=%s components=%s", branch, len(components))

    if not isinstance(components, list) or not components:
        return jsonify({
            "success": False,
            "error": "components list is required",
            "branch": branch,
            "production_state": []
        }), 400

    # Concurrency knob (safe default 8)
    max_workers = int(os.getenv("API_MAX_WORKERS", "8"))

    # Use existing global client if present, else make a local one
    gclient = globals().get("git_client")
    if gclient is None or not isinstance(gclient, BitBucketClient):
        gclient = BitBucketClient(app.logger)

    # Identify bundle types from registry (any type with kind == 'bundle')
    bundle_types = set()
    try:
        for tname, tinfo in (cr.TYPE_MAP if hasattr(cr, "TYPE_MAP") else cr.types()).items():
            if isinstance(tinfo, dict) and tinfo.get("kind") == "bundle":
                bundle_types.add(tname)
    except Exception:
        # fallback to a conservative, common set
        bundle_types = {
            "OmniScript", "IntegrationProcedure", "DataRaptor",
            "CalculationMatrix", "CalculationMatrixVersion", "Catalog",
            "PriceList", "AttributeCategory", "Product2",
            "OrchestrationItemDefinition", "OrchestrationDependencyDefinition"
        }

    def _process(component: dict) -> dict:
        """
        Process a single component, returning the per-row dict with the exact keys you expect.
        Never raises; returns a soft-error row on exceptions.
        """
        try:
            ctype = (component.get('type') or component.get('component_type') or '').strip()
            cname_raw = (component.get('name') or component.get('component_name') or '').strip()
            if not ctype or not cname_raw:
                raise ValueError(f"bad component entry: {component!r}")

            # Keep original name in response; normalize for lookup
            cname_norm = _strip_type_prefix(ctype, cname_raw)

            # --- Bundle path resolution ---
            if ctype in bundle_types:
                folder_any = gclient.resolve_vlocity_bundle(
                    branch=branch,
                    component_type=ctype,
                    component_name=cname_norm
                )
                # normalize folder to string (resolver may return str/tuple/dict)
                folder = None
                if isinstance(folder_any, str):
                    folder = folder_any
                elif isinstance(folder_any, (list, tuple)):
                    folder = next((v for v in folder_any if isinstance(v, str)), None)
                elif isinstance(folder_any, dict):
                    folder = folder_any.get("folder") or folder_any.get("path") or folder_any.get("dir")

                exists = bool(folder)
                file_path = None
                last_commit = None

                if exists:
                    primary = _pick_primary_file_for_bundle(gclient, branch, folder, ctype, cname_norm)
                    file_path = primary or folder  # prefer file; fallback to folder string

                    # Get last commit from primary file (fast)
                    if primary:
                        commits = gclient.get_file_commits(primary, branch=branch, limit=1) or []
                        last_commit = commits[0] if commits else None

                return {
                    "component_name": cname_raw,                  # keep user's original naming
                    "component_type": ctype,
                    "exists_in_prod": exists,
                    "file_path": file_path,
                    "file_size": 0,                               # unknown for folder; 0 for file unless we fetch
                    "last_author": (last_commit or {}).get("author"),
                    "last_commit_date": (last_commit or {}).get("date"),
                    "last_commit_hash": ((last_commit or {}).get("hash") or (last_commit or {}).get("short_hash") or None),
                    "last_commit_message": (last_commit or {}).get("message")
                }

            # --- Single-file types ---
            content, actual_path = gclient.get_file_content_smart(
                component_name=cname_norm,
                component_type=ctype,
                branch=branch
            )
            exists = content is not None
            file_path = actual_path
            last_commit = None

            if file_path:
                commits = gclient.get_file_commits(file_path, branch=branch, limit=1) or []
                last_commit = commits[0] if commits else None

            return {
                "component_name": cname_raw,
                "component_type": ctype,
                "exists_in_prod": exists,
                "file_path": file_path,
                "file_size": len(content) if content else 0,
                "last_author": (last_commit or {}).get("author"),
                "last_commit_date": (last_commit or {}).get("date"),
                "last_commit_hash": ((last_commit or {}).get("hash") or (last_commit or {}).get("short_hash") or None),
                "last_commit_message": (last_commit or {}).get("message")
            }

        except Exception as e:
            # Soft-fail row; never break the whole request
            return {
                "component_name": (component.get('name') or component.get('component_name') or ''),
                "component_type": (component.get('type') or component.get('component_type') or ''),
                "exists_in_prod": False,
                "file_path": None,
                "file_size": 0,
                "last_author": None,
                "last_commit_date": None,
                "last_commit_hash": None,
                "last_commit_message": f"error: {e}"
            }

    # --- Run components in parallel ---
    rows = []
    with ThreadPoolExecutor(max_workers=max_workers) as pool:
        futures = {pool.submit(_process, comp): comp for comp in components}
        for fut in as_completed(futures):
            rows.append(fut.result())

    # Preserve input order if you prefer (optional). Otherwise parallel completion order is fine.
    # Reorder by first appearance of (type,name) in input:
    order_map = { ( (c.get('type') or c.get('component_type')),
                    (c.get('name') or c.get('component_name')) ): i
                  for i, c in enumerate(components) }
    rows.sort(key=lambda r: order_map.get((r.get('component_type'), r.get('component_name')), 1_000_000))

    # --- Summaries ---
    existing = sum(1 for r in rows if r.get("exists_in_prod"))
    missing = len(rows) - existing

    resp = {
        "success": True,
        "branch": branch,
        "checked_at": datetime.utcnow().isoformat(),
        "total_components": len(rows),
        "existing": existing,
        "missing": missing,
        "production_state": rows
    }

    return jsonify(resp), 200



@app.route('/api/compare-deployment', methods=['POST'])
def compare_deployment():
    """
    Compare deployment components with production
    
    Returns which components are:
    - Modified (exist in both, different content)
    - New (only in deployment)
    - Same (exist in both, identical content)
    """
    try:
        data = request.json
        components = data.get('components', [])
        
        if not components:
            return jsonify({
                'success': False,
                'error': 'No components provided'
            }), 400
        
        git_client = BitBucketClient()
        comparison_results = []
        
        for component in components:
            component_name = component.get('name', '')
            component_type = component.get('type', '')
            
            # Remove type prefix if present
            if '.' in component_name:
                component_name = component_name.split('.', 1)[1]
            
            # Get production version (master branch)
            prod_content, prod_path = git_client.get_file_content_smart(
                component_name, 
                component_type, 
                branch='master'
            )
            
            # Get UAT version (uat branch or master - depending on your setup)
            # For now, we'll assume UAT = master since we don't have separate UAT branch
            # You can change this to 'uat' if you have a UAT branch
            uat_content, uat_path = git_client.get_file_content_smart(
                component_name, 
                component_type, 
                branch='uatsfdc'  # Change to 'uat' if you have UAT branch
            )
            
            print(f"\n{'='*60}")
            print(f"Component: {component_name}")
            print(f"Type: {component_type}")
            print(f"Prod exists: {prod_content is not None}")
            print(f"UAT exists: {uat_content is not None}")
            
            if prod_content and uat_content:
                print(f"Prod size: {len(prod_content)} chars")
                print(f"UAT size: {len(uat_content)} chars")
                print(f"Are identical: {prod_content == uat_content}")
    
            if prod_content != uat_content:
                # Show first difference
                for i, (c1, c2) in enumerate(zip(prod_content, uat_content)):
                    if c1 != c2:
                        print(f"First diff at position {i}: '{c1}' vs '{c2}'")
                        print(f"Context: ...{prod_content[max(0,i-20):i+20]}...")
                        break
            print(f"{'='*60}\n")

            # Determine status
            if prod_content is None and uat_content is None:
                status = 'NOT_FOUND'
            elif prod_content is None:
                status = 'NEW'
            elif uat_content is None:
                status = 'REMOVED'
            elif prod_content == uat_content:
                status = 'IDENTICAL'
            else:
                status = 'MODIFIED'
            
            comparison_results.append({
                'component_name': component_name,
                'component_type': component_type,
                'status': status,
                'in_production': prod_content is not None,
                'in_uat': uat_content is not None,
                'file_path': prod_path or uat_path
            })
        
        # Calculate summary
        summary = {
            'total': len(comparison_results),
            'modified': len([r for r in comparison_results if r['status'] == 'MODIFIED']),
            'new': len([r for r in comparison_results if r['status'] == 'NEW']),
            'identical': len([r for r in comparison_results if r['status'] == 'IDENTICAL']),
            'removed': len([r for r in comparison_results if r['status'] == 'REMOVED']),
            'not_found': len([r for r in comparison_results if r['status'] == 'NOT_FOUND'])
        }
        
        return jsonify({
            'success': True,
            'comparison': comparison_results,
            'summary': summary,
            'compared_at': datetime.now().isoformat()
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/verify-commit', methods=['POST'])
def verify_commit():
    """
    Verify if commit exists in production
    
    Request: {
        "commit_hash": "910e4e2",
        "branch": "master"
    }
    """
    try:
        data = request.json
        commit_hash = data.get('commit_hash', '')
        branch = data.get('branch', 'master')
        
        git_client = BitBucketClient()
        result = git_client.verify_commit_in_branch(commit_hash, branch)
        
        return jsonify({
            'success': True,
            'data': result
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/get-commit-changes', methods=['POST'])
def get_commit_changes():
    """
    Get what changed in a specific commit
    """
    try:
        data = request.json
        commit_hash = data.get('commit_hash', '')
        
        if not commit_hash:
            return jsonify({
                'success': False,
                'error': 'No commit hash provided'
            }), 400
        
        git_client = BitBucketClient()
        result = git_client.get_commit_changes(commit_hash)
        
        return jsonify(result)
        
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/analyze', methods=['POST'])
def analyze_csv():
    """Analyze deployment with optional production comparison"""
    
    # Validate files
    if 'deployment_file' not in request.files:
        return jsonify({'error': 'No deployment file provided'}), 400
    
    deployment_file = request.files['deployment_file']
    production_file = request.files.get('production_file')
    
    if deployment_file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    try:
        # Save deployment file
        deploy_filename = secure_filename(deployment_file.filename)
        deploy_path = os.path.join(app.config['UPLOAD_FOLDER'], deploy_filename)
        deployment_file.save(deploy_path)
        
        # Parse production state if provided
        prod_state = None
        if production_file and production_file.filename != '':
            prod_filename = secure_filename(production_file.filename)
            prod_path = os.path.join(app.config['UPLOAD_FOLDER'], prod_filename)
            production_file.save(prod_path)
            prod_state = parse_production_state(prod_path)
            os.remove(prod_path)
        
        # Parse deployment CSV
        parser = CopadoCSVParser()
        parsed_data = parser.parse_file(deploy_path)
        
        # Detect conflicts
        detector = ConflictDetector(parsed_data.user_stories)
        conflicts = detector.detect_conflicts()
        summary = detector.get_conflict_summary(conflicts)
        
        # Check for regressions
        regressions = []
        if prod_state:
            for story in parsed_data.user_stories:
                for component in story.components:
                    regression_check = check_regression(component, prod_state)
                    if regression_check and regression_check.get('is_regression'):
                        regressions.append({
                            'story_id': story.id,
                            'component': component.api_name,
                            **regression_check
                        })
        
        # Additional analyses
        story_conflicts = detector.analyze_story_to_story_conflicts()
        dev_coordination = detector.get_developer_coordination_map()
        deployment_sequence = detector.get_deployment_sequence(conflicts)
        
        # Clean up
        os.remove(deploy_path)
        
        # Build response
        response = {
            'success': True,
            'data': {
                'summary': {
                    'total_records': parsed_data.total_records,
                    'unique_stories': parsed_data.unique_stories,
                    'unique_components': parsed_data.unique_components,
                    'total_conflicts': summary['total_conflicts'],
                    'affected_stories': summary['affected_stories'],
                    'avg_risk_score': round(summary['avg_risk_score'], 1),
                    'severity_breakdown': summary['severity_breakdown'],
                    'total_regressions': len(regressions),
                    'production_check': prod_state is not None
                },
                'all_stories': [  # ADD THIS NEW FIELD
                    {
                        'id': story.id,
                        'title': story.title,
                        'developer': story.developer,
                        'jira_key': story.jira_key,
                        'component_count': len(story.components),
                        'components': [
                            {
                                'api_name': c.api_name,
                                'type': c.type.value,
                                'status': c.status.value if hasattr(c.status, 'value') else str(c.status),
                                'last_commit_date': c.last_commit_date.isoformat() if c.last_commit_date else None,
                                'commit_hash': c.commit_hash if hasattr(c, 'commit_hash') else None 
                            }
                            for c in story.components
                        ]
                    }
                for story in parsed_data.user_stories
                    ],
                'conflicts': [format_conflict(c) for c in conflicts[:20]],
                'regressions': regressions,
                'story_conflicts': story_conflicts[:10],
                'developer_coordination': dev_coordination,
                'deployment_sequence': deployment_sequence
            }
        }
        
        return jsonify(response), 200
        
    except Exception as e:
        if 'deploy_path' in locals() and os.path.exists(deploy_path):
            os.remove(deploy_path)
        
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

def format_conflict(conflict):
    """Format ConflictingComponent object for JSON response"""
    
    # Format stories with commit info
    stories_detailed = []
    from conflict_detector import ConflictDetector
    detector = ConflictDetector([])
    recommendation = detector.get_recommendation(conflict)
    
    # Check if we have the new field
    if hasattr(conflict, 'stories_with_commit_info') and conflict.stories_with_commit_info:
        for item in conflict.stories_with_commit_info:
            story = item['story']
            commit_date = item['commit_date']
            created_by = item['created_by']
            
            stories_detailed.append({
                'id': story.id,
                'title': story.title,
                'developer': story.developer,
                'jira_key': story.jira_key,
                'component_count': len(story.components),
                'commit_date': commit_date.isoformat() if commit_date else None,
                'created_by': created_by,
                'days_ago': (datetime.now(commit_date.tzinfo) - commit_date).days if commit_date else None
            })
    else:
        # Fallback to old format
        for story in conflict.involved_stories:
            stories_detailed.append({
                'id': story.id,
                'title': story.title,
                'developer': story.developer,
                'jira_key': story.jira_key,
                'component_count': len(story.components),
                'commit_date': None,
                'created_by': None,
                'days_ago': None
            })
    
    return {
        'component': {
            'api_name': conflict.component.api_name,
            'type': conflict.component.type.value,
            'status': conflict.component.status.value
        },
        'involved_stories': [
            {
                'id': story.id,
                'title': story.title,
                'developer': story.developer,
                'jira_key': story.jira_key,
                'component_count': len(story.components),
                'commit_date': next(  # ADD THIS
                    (c.last_commit_date.isoformat() if c.last_commit_date else None
                     for c in story.components 
                     if c.api_name == conflict.component.api_name), 
                    None
                ),
                'created_by': story.metadata.created_by if hasattr(story, 'metadata') else 'Unknown',
                'days_ago': (datetime.now(conflict.component.last_commit_date.tzinfo) - conflict.component.last_commit_date).days if conflict.component.last_commit_date else 0
            }
            for story in conflict.involved_stories
        ],
        'risk_score': conflict.risk_score,
        'severity': conflict.severity.name,
        'involved_stories': stories_detailed,
        'risk_factors': conflict.risk_factors,
        'recommendation': recommendation
    }


if __name__ == '__main__':
    print("=" * 60)
    print("🚀 Copado Deployment Validator API")
    print("=" * 60)
    print("Starting server on http://localhost:5000")
    print()
    print("Available endpoints:")
    print("  GET  /api/health  - Health check")
    print("  POST /api/analyze - Upload CSV for analysis")
    print()
    print("Press Ctrl+C to stop")
    print("=" * 60)
    
    app.run(debug=True, host='0.0.0.0', port=5000)