# sf_pr_fetcher.py
from typing import List, Dict, Any, Optional, Callable
import logging

log = logging.getLogger(__name__)

# --- dynamic import (works even if some names are missing) ---
try:
    import salesforce_client as sc  # your existing module
except Exception:
    sc = None  # type: ignore


def _get_sf_query_func(sf_obj) -> Optional[Callable[[str], Dict[str, Any]]]:
    """
    Return a callable that executes SOQL and returns a dict with optional 'records'.
    Tries multiple common method names so we don't rely on 'sf_query' specifically.
    """
    if sc is None or sf_obj is None:
        return None

    # Preferred helper at module level (if present)
    for name in ("sf_query",):
        if hasattr(sc, name):
            fn = getattr(sc, name)
            return lambda soql: fn(sf_obj, soql)

    # Try common instance methods on the session/client itself
    for name in ("query_all", "query", "soql_query"):
        if hasattr(sf_obj, name):
            fn = getattr(sf_obj, name)
            return lambda soql: fn(soql)

    # Try alternative module-level helpers that take (sf, soql)
    for name in ("sf_query_all", "soql", "run_soql"):
        if hasattr(sc, name):
            fn = getattr(sc, name)
            return lambda soql: fn(sf_obj, soql)

    return None


def _in(values: List[str]) -> str:
    return "(" + ",".join(f"'{v}'" for v in values) + ")"


def fetch_copado_prs(story_names: Optional[List[str]] = None,
                     release_name: Optional[str] = None) -> List[Dict[str, Any]]:
    """
    Fetch Copado PR rows by story_names OR release_name.
    Works even if 'sf_query' isn't defined, by detecting the right query function.
    """
    if sc is None or not hasattr(sc, "sf_login_from_config"):
        log.warning("[fetch_copado_prs] salesforce_client not available (import/login)")
        return []

    try:
        sf = sc.sf_login_from_config()
    except Exception as e:
        log.warning(f"[fetch_copado_prs] login failed: {e}")
        return []

    q = _get_sf_query_func(sf)
    if q is None:
        log.warning("[fetch_copado_prs] no usable query function found in salesforce_client")
        return []

    where = []
    if story_names:
        where.append(f"copado__User_Story__r.Name IN {_in(story_names)}")
    if release_name:
        where.append(f"copado__User_Story__r.copado__Release__r.Name = '{release_name}'")
    if not where:
        return []

    soql = f"""
    SELECT Id, Name, copado__User_Story__r.Name, copado__Target_Branch__c,
           copado__Url__c, copado__URL_Link__c, copado__Request_Number__c,
           copado__State__c, copado__Changed_Files__c, copado__Commits__c,
           copado__Approval_Status__c, copado__Reviewer_Approvals_Count__c
    FROM copado__Pull_Request__c
    WHERE {' OR '.join(where)}
    ORDER BY LastModifiedDate DESC
    """
    soql = " ".join(soql.split())
    log.info(f"[fetch_copado_prs] SOQL: {soql}")

    try:
        res = q(soql) or {}
        rows = res.get("records", []) if isinstance(res, dict) else res
        log.info(f"[fetch_copado_prs] rows={len(rows)}")
        return rows
    except Exception as e:
        log.warning(f"[fetch_copado_prs] query error: {e}")
        return []
