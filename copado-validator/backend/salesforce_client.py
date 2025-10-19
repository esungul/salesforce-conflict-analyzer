# salesforce_client.py
from __future__ import annotations
import json, os
from typing import Iterable, List,Dict
# Note: We import simple_salesforce inside the function to avoid import errors at build time.
# Install with: pip install simple-salesforce
import re
import logging
logger = logging.getLogger(__name__)


_ANCHOR_RE = re.compile(r'href=["\']([^"\']+)["\']', re.I)
_SHA_RE = re.compile(r'([a-f0-9]{7,40})', re.I)

_REQUIRED_FIELDS = [
    "copado__User_Story__r.copadoccmint__JIRA_key__c",
    "copado__User_Story__r.copado__Developer__r.Name",
    "copado__User_Story__r.CreatedBy.Name",
    "copado__User_Story__r.LastModifiedBy.Name",
]

# NEW: record-level audits on copado__User_Story_Metadata__c (the row itself)
_RECORD_AUDIT_FIELDS = [
    "CreatedBy.Name",
    "LastModifiedBy.Name",
]
_FIELDS = [
    "copado__User_Story__r.Name",
    "copado__User_Story__r.copado__User_Story_Title__c",
    "copado__User_Story__r.copado__Release__r.Name",
    "copado__User_Story__r.copado__Project__r.Name",
    "copado__User_Story__r.copado__Developer__r.Name",
    "copado__User_Story__r.copado__Close_Date__c",
    "copado__User_Story__r.copado__Story_Points_SFDC__c",
    "copado__User_Story__r.copado__Environment__r.Name",
    "copado__User_Story__r.copadoccmint__JIRA_key__c",
    "copado__Metadata_API_Name__c",
    "copado__Type__c",
    "copado__Category__c",
    "copado__Action__c",
    "copado__Status__c",
    "copado__ModuleDirectory__c",
    "copado__Last_Commit_Date__c",
    "copado__JsonInformation__c",
    "copado__Unique_ID__c",
    "CreatedDate",
    "CreatedBy.Name",
    "LastModifiedDate",
    "LastModifiedBy.Name",
]

def ensure_required_fields(field_list):
    before = len(field_list)
    seen = set(field_list)
    for f in _REQUIRED_FIELDS + _RECORD_AUDIT_FIELDS:
        if f not in seen:
            field_list.append(f)
            seen.add(f)
    added = len(field_list) - before
    logger.info(
        "SOQL projection: %s (total=%d)",
        f"+{added} added" if added else "no change",
        len(field_list),
    )
    return field_list

def _query_all(sf, soql: str) -> list[dict]:
    logger.info("Running SOQL: %s", soql)
    resp = sf.query_all(soql)
    records = resp.get("records", []) if isinstance(resp, dict) else (resp or [])
    logger.info("SOQL returned %d record(s).", len(records))
    return records

def fetch_user_story_metadata_by_release(sf, release_names: list[str]) -> list[dict]:
    records: list[dict] = []
    for batch in chunked(release_names, 100):
        soql = f"""
            SELECT {", ".join(_FIELDS)}
            FROM copado__User_Story_Metadata__c
            WHERE copado__User_Story__r.copado__Release__r.Name IN {soql_in(batch)}
            ORDER BY copado__Last_Commit_Date__c
        """
        records.extend(_query_all(sf, soql))
        
    return records

def fetch_user_story_metadata_by_story_names(sf, story_names: list[str]) -> list[dict]:
    records: list[dict] = []
    for batch in chunked(story_names, 100):
        soql = f"""
            SELECT {", ".join(_FIELDS)}
            FROM copado__User_Story_Metadata__c
            WHERE copado__User_Story__r.Name IN {soql_in(batch)}
            ORDER BY copado__Last_Commit_Date__c
        """
        records.extend(_query_all(sf, soql))
    return records

def sf_login_from_config(config_json_path: str | None = None):
    """
    Log in to Salesforce using either a JSON config file or environment variables.
    JSON/env keys: SF_USERNAME, SF_PASSWORD, SF_SECURITY_TOKEN, SF_DOMAIN (defaults 'login').
    """
    try:
        if config_json_path:
            with open(config_json_path, "r", encoding="utf-8") as f:
                cfg = json.load(f)
            from simple_salesforce import Salesforce  # imported here to keep module import lightweight
            return Salesforce(
                username=cfg["SF_USERNAME"],
                password=cfg["SF_PASSWORD"],
                security_token=cfg["SF_SECURITY_TOKEN"],
                domain=cfg.get("SF_DOMAIN", "login"),
            )
        # fallback to env vars
        from simple_salesforce import Salesforce  # imported here
        return Salesforce(
            username=os.environ["SF_USERNAME"],
            password=os.environ["SF_PASSWORD"],
            security_token=os.environ["SF_SECURITY_TOKEN"],
            domain=os.environ.get("SF_DOMAIN", "login"),
        )
    except KeyError as ke:
        raise RuntimeError(f"Missing Salesforce credential: {ke}") from ke
    except Exception as e:
        # Bubble up a concise error; full stack trace will be in server logs
        raise RuntimeError(f"Salesforce auth failed: {e}") from e


def chunked(values: Iterable[str], n: int) -> List[list]:
    """
    Yield lists of length <= n from an iterable. Used later for SOQL IN clause chunking.
    """
    buf, out = [], []
    for v in values:
        buf.append(v)
        if len(buf) == n:
            out.append(buf)
            buf = []
    if buf:
        out.append(buf)
    return out


def soql_in(values: Iterable[str]) -> str:
    """
    Safely quote values for a SOQL IN clause: ('a','b',...).
    Escapes single quotes.
    """
    items = []
    for v in values:
        if not isinstance(v, str):
            v = str(v)
        items.append("'" + v.replace("'", "\'") + "'")
    return "(" + ",".join(items) + ")"

def _parse_commit_from_view_in_git(html: str) -> Dict[str, str | None]:
    """
    Extract commit_url and full commit_sha from Copado's anchor field
    like: <a href="https://.../commits/<sha>">3034134</a>
    """
    if not html or not isinstance(html, str):
        return {"commit_url": None, "commit_sha": None}

    m = _ANCHOR_RE.search(html)
    commit_url = m.group(1) if m else None

    commit_sha = None
    if commit_url:
        tail = commit_url.rstrip("/").split("/")[-1]
        msh = _SHA_RE.search(tail)
        if msh:
            commit_sha = msh.group(1)

    if not commit_sha:
        fallback = _SHA_RE.search(html)
        if fallback:
            commit_sha = fallback.group(1)

    return {"commit_url": commit_url, "commit_sha": commit_sha}

def fetch_story_commits(sf, user_story_names: List[str]) -> List[Dict]:
    """
    Return normalized commit info for Copado user stories:
      {
        "user_story_name": "US-0033655",
        "user_story_id": "...",
        "environment": "production",
        "snapshot_commit": "...",
        "commit_url": "https://.../commits/<sha>",
        "commit_sha": "<sha>"
      }
    """
    if not user_story_names:
        return []

    fields = [
        "copado__User_Story__r.Name",
        "copado__User_Story__c",
        "copado__User_Story__r.copado__Environment__r.Name",
        "copado__Snapshot_Commit__c",
        "copado__View_in_Git__c",
    ]

    out: List[Dict] = []
    for batch in chunked(user_story_names, 100):
        soql = f"""
            SELECT {", ".join(fields)}
            FROM copado__User_Story_Commit__c
            WHERE copado__User_Story__r.Name IN {soql_in(batch)}
        """
        recs = sf.query_all(soql).get("records", [])
        for r in recs:
            html = r.get("copado__View_in_Git__c")
            parsed = _parse_commit_from_view_in_git(html)
            out.append({
                "user_story_name": (r.get("copado__User_Story__r") or {}).get("Name"),
                "user_story_id": r.get("copado__User_Story__c"),
                "environment": (r.get("copado__User_Story__r") or {}).get("copado__Environment__r", {}).get("Name"),
                "snapshot_commit": r.get("copado__Snapshot_Commit__c"),
                "commit_url": parsed["commit_url"],
                "commit_sha": parsed["commit_sha"],
            })
    return out

def ensure_required_fields(field_list):
    """
    Idempotently extend your SELECT projection with the required fields.
    Usage: fields = ensure_required_fields(fields)
    """
    before = len(field_list)
    seen = set(field_list)
    for f in _REQUIRED_FIELDS:
        if f not in seen:
            field_list.append(f)
            seen.add(f)
    added = len(field_list) - before
    if added:
        logger.debug("SOQL projection: added %d required field(s), total=%d", added, len(field_list))
    else:
        logger.debug("SOQL projection: all required fields present, total=%d", len(field_list))
    return field_list
