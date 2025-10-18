# --- BEGIN PATCH: sf_adapter.py ---

from __future__ import annotations
from typing import Dict, List, Any, Optional
import json
import logging

logger = logging.getLogger(__name__)

def _get(d: Dict[str, Any], *path: str):
    cur = d
    for p in path:
        if cur is None:
            return None
        cur = cur.get(p)
    return cur

def _first(*vals: Any) -> Optional[str]:
    for v in vals:
        if v is None:
            continue
        s = str(v).strip()
        if s:
            return s
    return None

def _extract_commit_created_by(json_blob: Any) -> Optional[str]:
    if not json_blob:
        return None
    try:
        data = json.loads(json_blob) if isinstance(json_blob, str) else json_blob
    except Exception as e:
        logger.debug("Commit JSON parse failed; ignoring. error=%s", e)
        return None
    seq = []
    if isinstance(data, dict):
        seq = data.get("commits") or data.get("changes") or []
        if isinstance(seq, dict):
            seq = [seq]
    elif isinstance(data, list):
        seq = data
    for c in seq or []:
        if isinstance(c, dict):
            who = _first(c.get("created_by"))
            if who:
                return who
    return None

def _pick_developer(r: Dict[str, Any]) -> Optional[str]:
    """
    EXACT chain:
      1) US.copado__Developer__r.Name
      2) US.CreatedBy.Name
      3) US.LastModifiedBy.Name
      4) Record-level CreatedBy.Name (on copado__User_Story_Metadata__c)
      5) Record-level LastModifiedBy.Name (on copado__User_Story_Metadata__c)
      6) commit created_by (copado__JsonInformation__c)
    """
    us = _get(r, "copado__User_Story__r", "Name")

    v = _first(
        _get(r, "copado__User_Story__r", "copado__Developer__r", "Name"),
        _get(r, "copado__User_Story__r", "CreatedBy", "Name"),
        _get(r, "copado__User_Story__r", "LastModifiedBy", "Name"),
        _get(r, "CreatedBy", "Name") or r.get("CreatedBy.Name"),              # NEW
        _get(r, "LastModifiedBy", "Name") or r.get("LastModifiedBy.Name"),    # NEW
        _extract_commit_created_by(r.get("copado__JsonInformation__c")),
    )
    if v:
        source = (
            "US.Developer"
            if v == _get(r, "copado__User_Story__r", "copado__Developer__r", "Name") else
            "US.CreatedBy"
            if v == _get(r, "copado__User_Story__r", "CreatedBy", "Name") else
            "US.LastModifiedBy"
            if v == _get(r, "copado__User_Story__r", "LastModifiedBy", "Name") else
            "Record.CreatedBy"
            if v == (_get(r, "CreatedBy", "Name") or r.get("CreatedBy.Name")) else
            "Record.LastModifiedBy"
            if v == (_get(r, "LastModifiedBy", "Name") or r.get("LastModifiedBy.Name")) else
            "commit.created_by"
        )
        logger.debug("developer=%s '%s' [US=%s]", source, v, us)
        return v

    # Diagnostic: print what we *actually* saw when everything failed
    logger.debug(
        "developer=(none) after chain [US=%s] seen={US.Dev:%r, US.CB:%r, US.LMB:%r, Rec.CB:%r, Rec.LMB:%r, Commit:%r}",
        us,
        _get(r, "copado__User_Story__r", "copado__Developer__r", "Name"),
        _get(r, "copado__User_Story__r", "CreatedBy", "Name"),
        _get(r, "copado__User_Story__r", "LastModifiedBy", "Name"),
        _get(r, "CreatedBy", "Name") or r.get("CreatedBy.Name"),
        _get(r, "LastModifiedBy", "Name") or r.get("LastModifiedBy.Name"),
        "<present>" if r.get("copado__JsonInformation__c") else None,
    )
    return None

def _pick_jira_key(r: Dict[str, Any]) -> Optional[str]:
    us = _get(r, "copado__User_Story__r", "Name")
    key = _get(r, "copado__User_Story__r", "copadoccmint__JIRA_key__c")
    if _first(key):
        logger.debug("jira_key=US.copadoccmint__JIRA_key__c '%s' [US=%s]", key, us)
        return key
    logger.debug("jira_key=(none) after exact field [US=%s]", us)
    return None

def sf_records_to_rows(records: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    for r in records or []:
        row = {
            "copado__User_Story__r.Name": _get(r, "copado__User_Story__r", "Name"),
            "copado__User_Story__r.copado__User_Story_Title__c": _get(r, "copado__User_Story__r", "copado__User_Story_Title__c"),
            "copado__Metadata_API_Name__c": r.get("copado__Metadata_API_Name__c") or r.get("copado__Component__c"),
            "copado__Type__c": r.get("copado__Type__c"),
            "copado__Category__c": r.get("copado__Category__c"),
            "copado__Action__c": r.get("copado__Action__c"),
            "copado__Status__c": r.get("copado__Status__c"),
            "copado__ModuleDirectory__c": r.get("copado__ModuleDirectory__c"),
            "copado__Last_Commit_Date__c": r.get("copado__Last_Commit_Date__c"),
            "copado__JsonInformation__c": r.get("copado__JsonInformation__c"),
            "copado__Unique_ID__c": r.get("copado__Unique_ID__c"),
            "CreatedDate": r.get("CreatedDate"),
            "CreatedBy.Name": _get(r, "CreatedBy", "Name"),
            "LastModifiedDate": r.get("LastModifiedDate"),
            "LastModifiedBy.Name": _get(r, "LastModifiedBy", "Name"),
        }

        # FINAL fields
        row["developer"] = _pick_developer(r) or "—"
        row["jira_key"]  = _pick_jira_key(r) or None

        rows.append(row)

    logger.debug("SF adapter produced %d normalized row(s).", len(rows))
    if rows:
        try:
            import json as _json
            logger.debug("SF adapter sample row: %s", _json.dumps(rows[1], ensure_ascii=False)[:1200])
        except Exception as _e:
            logger.debug("SF adapter sample row (repr): %r", rows[1])
    return rows

# --- END PATCH: sf_adapter.py ---
