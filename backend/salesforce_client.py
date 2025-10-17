# salesforce_client.py
from __future__ import annotations
import json, os
from typing import Iterable, List
# Note: We import simple_salesforce inside the function to avoid import errors at build time.
# Install with: pip install simple-salesforce


_FIELDS = [
    "copado__User_Story__r.Name",
    "copado__User_Story__r.copado__User_Story_Title__c",
    "copado__User_Story__r.copado__Release__r.Name",
    "copado__User_Story__r.copado__Project__r.Name",
    "copado__User_Story__r.copado__Developer__r.Name",
    "copado__User_Story__r.copado__Close_Date__c",
    "copado__User_Story__r.copado__Story_Points_SFDC__c",
    "copado__User_Story__r.copado__Environment__r.Name",
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

def _query_all(sf, soql: str):
    res = sf.query_all(soql)
    return res.get("records", [])

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
