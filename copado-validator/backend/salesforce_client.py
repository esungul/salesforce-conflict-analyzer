# salesforce_client.py
from __future__ import annotations
import json, os
from typing import Iterable, List,Dict,Optional
# Note: We import simple_salesforce inside the function to avoid import errors at build time.
# Install with: pip install simple-salesforce
import re
import logging
logger = logging.getLogger(__name__)
log = logging.getLogger(__name__)
from vlocity_query_builder import VlocityQueryBuilder





_ANCHOR_RE = re.compile(r'href=["\']([^"\']+)["\']', re.I)
_SHA_RE = re.compile(r'([a-f0-9]{7,40})', re.I)
_SHA40_RE = re.compile(r'\b([a-f0-9]{40})\b', re.I)


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


def fetch_user_story_metadata_by_story_names(sf, story_names: list[str] = None, release_names: list[str] = None) -> list[dict]:
    """
    Fetch user story metadata by either story names OR release names
    """
    records: list[dict] = []
    
    # Query by story names
    if story_names:
        for batch in chunked(story_names, 100):
            soql = f"""
                SELECT {", ".join(_FIELDS)}
                FROM copado__User_Story_Metadata__c
                WHERE copado__User_Story__r.Name IN {soql_in(batch)}
                ORDER BY copado__Last_Commit_Date__c
            """
            records.extend(_query_all(sf, soql))
    
    # Query by release names
    if release_names:
        for batch in chunked(release_names, 100):
            soql = f"""
                SELECT {", ".join(_FIELDS)}
                FROM copado__User_Story_Metadata__c
                WHERE copado__User_Story__r.copado__Release__r.Name IN {soql_in(batch)}
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
        logger.debug(f"[SF] Haribooolllllll fetch_story_commits got {len(recs)} records")

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



def _sha_from_external_id(ext_id: Optional[str]) -> Optional[str]:
    if not ext_id: return None
    if "_" in ext_id:
        tail = ext_id.rsplit("_", 1)[-1]
        if _SHA40_RE.fullmatch(tail): return tail.lower()
    m = _SHA40_RE.search(ext_id)
    if m: return m.group(1).lower()
    return None

# --- replace your fetch_story_commits with this (shape preserved; extra fields added) ---
def fetch_story_commits(sf, user_story_names: List[str]) -> List[Dict]:
    if not user_story_names: return []
    fields = [
        "copado__User_Story__r.Name",
        "copado__User_Story__c",
        "copado__User_Story__r.copado__Environment__r.Name",
        "copado__Snapshot_Commit__c",
        "copado__View_in_Git__c",
        "copado__External_Id__c",  # NEW
    ]
    out: List[Dict] = []
    for batch in chunked(user_story_names, 100):
        soql = f"""
            SELECT {", ".join(fields)}
            FROM copado__User_Story_Commit__c
            WHERE copado__User_Story__r.Name IN {soql_in(batch)}
        """
        logger.info(f"[SF] fetch_story_commits SOQL: {soql.strip()}")
        recs = sf.query_all(soql).get("records", [])
        logger.info(f"[SF] fetch_story_commits rows={len(recs)}")
        for r in recs:
            long_sha = _sha_from_external_id(r.get("copado__External_Id__c"))
            html = r.get("copado__View_in_Git__c") or ""
            short = None; url = None
            # very small extractor for <a href=...>hash</a>
            m = re.search(r'href="([^"]+)"[^>]*>([0-9a-fA-F]+)</a>', html)
            if m:
                url = m.group(1); short = m.group(2).lower()
            commit_sha = long_sha or short
            out.append({
                "user_story_name": (r.get("copado__User_Story__r") or {}).get("Name"),
                "user_story_id": r.get("copado__User_Story__c"),
                "environment": (r.get("copado__User_Story__r") or {}).get("copado__Environment__r", {}).get("Name"),
                "snapshot_commit": r.get("copado__Snapshot_Commit__c"),
                "commit_url": url,
                "commit_sha": commit_sha,
                "commit_sha_short": (short or (long_sha[:7] if long_sha else None)),
            })
    return out

def fetch_vlocity_component_state(sf, components: List[Dict]) -> List[Dict]:
    """
    Fetch Vlocity component state from production using configurable queries
    
    Args:
        sf: Salesforce connection
        components: List of components to check
    
    Returns:
        List of Salesforce records for Vlocity components
    """
    if not components:
        logger.info("[VLOCITY] No components to fetch")
        return []
    
    try:
        # Load query builder with config
        builder = VlocityQueryBuilder()
        
        # Build queries for all components
        queries = builder.build_bulk_query(components)
        
        logger.info(f"[VLOCITY] Built {len(queries)} queries for component types")
        
        # Execute queries
        all_records = []
        for comp_type, query in queries.items():
            logger.info(f"[VLOCITY] Querying {comp_type}...")
            logger.info(f"[VLOCITY] Query: {query}")
            
            try:
                result = sf.query_all(query)
                records = result.get('records', [])
                
                logger.info(f"[VLOCITY] Found {len(records)} {comp_type} records")
                
                # Normalize records to match standard format
                normalized = []
                for rec in records:
                    # Keep ALL fields from the record
                    normalized_rec = dict(rec)  # Copy all fields
                    normalized_rec['_component_type'] = comp_type  # Add our tag
                    normalized.append(normalized_rec)
                all_records.extend(normalized)
                
            except Exception as e:
                logger.error(f"[VLOCITY] Error querying {comp_type}: {e}")
                import traceback
                logger.error(traceback.format_exc())
                continue
        
        logger.info(f"[VLOCITY] Total records fetched: {len(all_records)}")
        return all_records
        
    except Exception as e:
        logger.error(f"[VLOCITY] Error fetching component state: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return []


def _query_tooling(self, query: str) -> Optional[List[Dict]]:
    """
    Execute Tooling API query
    
    Args:
        query: SOQL query string
        
    Returns:
        List of records or None if failed
    """
    try:
        # Option 1: If using simple_salesforce directly
        if hasattr(self.sf, 'toolingexecute'):
            result = self.sf.toolingexecute(f"query/?q={query}")
            return result.get('records', []) if result else []
        
        # Option 2: If you added query_tooling to salesforce_client
        from salesforce_client import query_tooling
        return query_tooling(self.sf, query)
        
    except Exception as e:
        logger.error(f"      Tooling API query failed: {e}")
        return None

def get_user_stories_from_release(sf, release_name: str) -> List[str]:
    """Get all user story names from a release"""
    try:
        log.info(f"🔍 Getting user stories from release: {release_name}")
        
        safe_release_name = release_name.replace("'", "\\'")
        
        query = f"""
            SELECT copado__User_Story__r.Name
            FROM copado__User_Story_Commit__c
            WHERE copado__User_Story__r.copado__Release__r.Name = '{safe_release_name}'
        """
        
        log.info(f"   Query: {query}")
        result = sf.query(query)  # ← Changed from self.sf to sf
        
        story_names = set()
        for record in result.get('records', []):
            if record.get('copado__User_Story__r'):
                story_names.add(record['copado__User_Story__r']['Name'])
        
        user_stories = sorted(list(story_names))
        log.info(f"   ✅ Found {len(user_stories)} stories")
        return user_stories
        
    except Exception as e:
        log.error(f"   ✗ Error: {e}")
        import traceback
        log.error(traceback.format_exc())
        return []

def fetch_production_component_state(sf, components: List[Dict]) -> List[Dict]:
    if not components:
        logger.info("[SF] No components provided for production state lookup")
        return []
    
    api_names = [comp.get("api_name") for comp in components if comp.get("api_name")]
    logger.info(f"[SF] Running production state query with {len(api_names)} components")
    
    if not api_names:
        logger.info("[SF] No valid API names found")
        return []
    
    # CHUNK the API names to avoid SOQL limits
    all_records = []
    batches = list(chunked(api_names, 50))
    logger.info(f"[SF] Processing {len(batches)} batches")
    
    for i, batch in enumerate(batches):
        soql = f"""
            SELECT 
                copado__Metadata_API_Name__c,
                copado__Type__c,
                copado__Last_Commit_Date__c,
                copado__User_Story__r.Name,
                copado__User_Story__r.copado__User_Story_Title__c,
                LastModifiedDate,
                LastModifiedBy.Name
            FROM copado__User_Story_Metadata__c
            WHERE copado__Metadata_API_Name__c IN {soql_in(batch)}
            AND copado__User_Story__r.copado__Environment__r.Name = 'production'
            ORDER BY copado__Last_Commit_Date__c DESC
        """
        
        logger.info(f"[SF] Batch {i+1}/{len(batches)}: {len(batch)} components")
        
        try:
            result = sf.query_all(soql)
            records = result.get("records", [])
            all_records.extend(records)
            logger.info(f"[SF] Batch {i+1} got {len(records)} production records")
                    
        except Exception as e:
            logger.error(f"[SF] Error in production state batch {i+1}: {str(e)}")
            continue
    
    logger.info(f"[SF] Total production records fetched: {len(all_records)}")
    
    if all_records:
        logger.info(f"[SF] Starting normalization of {len(all_records)} records")
        
        # NORMALIZE: Convert SF format to consistent flat structure
        normalized = []
        normalized_count = 0
        
        for rec in all_records:
            # Handle nested User Story relationship
            user_story = rec.get("copado__User_Story__r") or {}
            
            normalized_rec = {
                "copado__Metadata_API_Name__c": rec.get("copado__Metadata_API_Name__c"),
                "copado__Type__c": rec.get("copado__Type__c"),
                "copado__Last_Commit_Date__c": rec.get("copado__Last_Commit_Date__c"),
                "copado__User_Story__r.Name": user_story.get("Name"),
                "copado__User_Story__r.copado__User_Story_Title__c": user_story.get("copado__User_Story_Title__c"),
                "LastModifiedDate": rec.get("LastModifiedDate"),
                "LastModifiedBy.Name": rec.get("LastModifiedBy.Name") or (rec.get("LastModifiedBy") or {}).get("Name")
            }
            normalized.append(normalized_rec)
            normalized_count += 1
            
            # Log first few and every 100th record
            if normalized_count <= 3 or normalized_count % 100 == 0:
                logger.debug(f"[SF] Normalized {normalized_count}: {normalized_rec['copado__Metadata_API_Name__c']} → story={normalized_rec['copado__User_Story__r.Name']}")
        
        logger.info(f"[SF] Completed normalization: {len(normalized)} records")
        return normalized
    
    logger.info("[SF] No records to normalize, returning empty list")
    return all_records



def fetch_deployment_tasks(sf, release_names: list[str] = None, story_names: list[str] = None) -> list[dict]:
    """
    Fetch deployment tasks for stories that might not have commit records
    """
    if not release_names and not story_names:
        logger.info("[SF] No release_names or story_names provided for deployment tasks")
        return []
    
    # ✅ ENHANCED FIELD SELECTION - include both nested and flat versions
    fields = [
        "copado__User_Story__r.Name",
        "copado__User_Story__r.copado__User_Story_Title__c",
        "copado__User_Story__r.copado__Release__r.Name", 
        "copado__User_Story__r.copado__Environment__r.Name",
        "copado__User_Story__r.copado__Last_Validation_Deployment_Status__c",
        "copado__Perform_Manual_Task__c",
        "copado__Status__c",
        "CreatedDate",
        "CreatedBy.Name",  # ✅ Also get flat field
        "LastModifiedDate", 
        "LastModifiedBy.Name"  # ✅ Also get flat field
    ]
    
    conditions = []
    if release_names:
        conditions.append(f"copado__User_Story__r.copado__Release__r.Name IN {soql_in(release_names)}")
    if story_names:
        conditions.append(f"copado__User_Story__r.Name IN {soql_in(story_names)}")
    
    # ✅ FIX: Change AND to OR
    where_clause = " OR ".join(conditions) if conditions else ""
    
    soql = f"""
        SELECT {", ".join(fields)}
        FROM copado__Deployment_Task__c
        {f"WHERE {where_clause}" if where_clause else ""}
        ORDER BY copado__User_Story__r.Name, CreatedDate
    """
    
    logger.info(f"[SF] Fetching deployment tasks: {len(release_names or [])} releases, {len(story_names or [])} stories")
    logger.debug(f"[SF] Deployment task SOQL: {soql}")
    
    records = _query_all(sf, soql)
    logger.info(f"[SF] Found {len(records)} deployment task records")
    
    # ✅ LOG FIELD AVAILABILITY IN RESPONSE
    if records:
        first_record = records[0]
        logger.info(f"[SF] First deployment task record keys: {list(first_record.keys())}")
        if 'CreatedBy' in first_record:
            logger.debug(f"[SF] CreatedBy structure: {type(first_record['CreatedBy'])} -> {first_record['CreatedBy']}")
        if 'LastModifiedBy' in first_record:
            logger.info(f"[SF] LastModifiedBy structure: {type(first_record['LastModifiedBy'])} -> {first_record['LastModifiedBy']}")
    
    return records