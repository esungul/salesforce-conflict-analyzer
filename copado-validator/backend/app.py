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
from typing import Optional, Tuple,Dict,List
import copy
from sf_adapter import sf_records_to_rows
import csv
from tempfile import NamedTemporaryFile
from salesforce_client import (
    sf_login_from_config,
    fetch_user_story_metadata_by_release,
    fetch_user_story_metadata_by_story_names,
    fetch_story_commits
)


import logging
logging.basicConfig(level=logging.DEBUG)  # put once (e.g., in app.py main)
logger = logging.getLogger(__name__)
import json
import re
import logging
import os

def setup_logging():
    """
    Configure consistent logging for all modules.
    Set LOG_LEVEL=DEBUG in your environment to see debug logs.
    """
    log_level = os.getenv("LOG_LEVEL", "INFO").upper()
    logging.basicConfig(
        level=getattr(logging, log_level, logging.INFO),
        format="%(asctime)s %(levelname)s [%(name)s]: %(message)s",
    )

    # Silence noisy libraries
    logging.getLogger("urllib3").setLevel(logging.WARNING)
    logging.getLogger("simple_salesforce").setLevel(logging.WARNING)
    logging.getLogger("werkzeug").setLevel(logging.INFO)

    logging.getLogger(__name__).info("Logging initialized at %s level", log_level)

# Call this early — before importing your submodules if possible
setup_logging()



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




############# Testing 

# Add to app.py - NEW TRANSFORMER for story analysis

import logging
from datetime import datetime
from typing import Dict, List, Tuple, Optional
import copy
import json
import re

logger = logging.getLogger(__name__)


# Add to app.py - NEW TRANSFORMER for story analysis

import logging
from datetime import datetime
from typing import Dict, List, Tuple, Optional
import copy
import json
import re

logger = logging.getLogger(__name__)

# Add to app.py - NEW TRANSFORMER for story analysis

import logging
from datetime import datetime
from typing import Dict, List, Tuple, Optional
import copy
import json
import re

logger = logging.getLogger(__name__)


# Add to app.py - NEW TRANSFORMER for story analysis

import logging
from datetime import datetime
from typing import Dict, List, Tuple, Optional
import copy
import json
import re

logger = logging.getLogger(__name__)




# Add to app.py - NEW TRANSFORMER for story analysis

import logging
from datetime import datetime
from typing import Dict, List, Tuple, Optional
import copy
import json
import re

logger = logging.getLogger(__name__)

class StoryAnalyzerTransformer:
    """
    Transform raw SF Copado records into structured response with:
    - Blocked stories (old commits + conflicts)
    - Conflicting stories (same component, current commits)
    - Safe stories (no conflicts, all current)
    """
    
    def __init__(self):
        self.stories = {}  # story_id -> story data
        self.components = {}  # component_id -> component data
        self.component_to_stories = {}  # api_name -> [story_ids]
        self.conflicts_map = {}  # api_name -> list of story_ids
        
        logger.info("[INIT] StoryAnalyzerTransformer initialized")
    
    def parse_commit_url_from_json(self, json_blob: str) -> Optional[str]:
        """Extract commit URL from copado__JsonInformation__c"""
        try:
            if not json_blob:
                return None
            
            data = json.loads(json_blob) if isinstance(json_blob, str) else json_blob
            
            # Look for common patterns
            if isinstance(data, dict):
                # Direct URL field
                for key in ["commit_url", "commitUrl", "url", "link", "href"]:
                    if key in data and data[key]:
                        return data[key]
                
                # Look in nested structures (commits, changes)
                for key in ["commits", "changes", "commit", "change"]:
                    if key in data:
                        item = data[key]
                        if isinstance(item, dict):
                            for url_key in ["url", "link", "href"]:
                                if url_key in item and item[url_key]:
                                    return item[url_key]
                        elif isinstance(item, list) and len(item) > 0:
                            first = item[0]
                            if isinstance(first, dict):
                                for url_key in ["url", "link", "href"]:
                                    if url_key in first and first[url_key]:
                                        return first[url_key]
            
            # If JSON has HTML anchors, parse them
            if isinstance(data, str):
                match = re.search(r'href=["\']([^"\']+)["\']', data)
                if match:
                    return match.group(1)
            
            return None
        except Exception as e:
            logger.debug(f"[PARSE_URL] Error parsing JSON blob: {e}")
            return None
    
    def parse_commit_hash_from_json(self, json_blob: str) -> Optional[str]:
        """Extract commit hash/SHA from copado__JsonInformation__c"""
        try:
            if not json_blob:
                return None
            
            data = json.loads(json_blob) if isinstance(json_blob, str) else json_blob
            
            # Look for common SHA patterns in dict
            if isinstance(data, dict):
                # Direct hash fields
                for key in ["commit_hash", "commitHash", "hash", "sha", "commit_sha", "commitSha"]:
                    if key in data and data[key]:
                        val = str(data[key]).strip()
                        if val and len(val) >= 7:  # Valid SHA should be at least 7 chars
                            return val
                
                # Look in nested structures
                for key in ["commits", "changes", "commit", "change"]:
                    if key in data:
                        item = data[key]
                        if isinstance(item, dict):
                            for hash_key in ["hash", "sha", "id", "commit_hash"]:
                                if hash_key in item and item[hash_key]:
                                    val = str(item[hash_key]).strip()
                                    if val and len(val) >= 7:
                                        return val
                        elif isinstance(item, list) and len(item) > 0:
                            first = item[0]
                            if isinstance(first, dict):
                                for hash_key in ["hash", "sha", "id", "commit_hash"]:
                                    if hash_key in first and first[hash_key]:
                                        val = str(first[hash_key]).strip()
                                        if val and len(val) >= 7:
                                            return val
            
            # If JSON is string with HTML, extract SHA from URL
            if isinstance(data, str):
                # Look for SHA patterns in URLs: /commits/abc123def456
                match = re.search(r'/commits/([a-f0-9]{7,40})', data)
                if match:
                    return match.group(1)
                
                # Look for standalone SHA patterns
                match = re.search(r'\b([a-f0-9]{7,40})\b', data)
                if match:
                    return match.group(1)
            
            return None
        except Exception as e:
            logger.debug(f"[PARSE_HASH] Error parsing JSON blob: {e}")
            return None
    
    def transform(self, sf_records: List[Dict]) -> Dict:
        """
        Main transformation pipeline with detailed logging
        
        Args:
            sf_records: Raw records from SF (from sf_records_to_rows or similar)
        
        Returns:
            Structured response with blocked/conflicts/safe stories
        """
        
        logger.info(f"[TRANSFORM] Starting with {len(sf_records)} SF records")
        
        # Step 1: Group records by story
        stories_data = self._group_by_story(sf_records)
        logger.info(f"[TRANSFORM] Step 1 complete: {len(stories_data)} unique stories")
        
        # Step 2: Extract and normalize component data
        self._extract_components(stories_data, sf_records)
        logger.info(f"[TRANSFORM] Step 2 complete: {len(self.components)} unique components extracted")
        
        # Step 3: Detect conflicts (same component in multiple stories)
        self._detect_conflicts()
        logger.info(f"[TRANSFORM] Step 3 complete: {len(self.conflicts_map)} components with conflicts")
        
        # Step 4: Classify stories
        blocked, conflicts, safe = self._classify_stories()
        logger.info(f"[TRANSFORM] Step 4 complete: blocked={len(blocked)}, conflicts={len(conflicts)}, safe={len(safe)}")
        
        # Step 5: Enrich with conflicting story details
        blocked = self._enrich_with_conflicts(blocked, sf_records)
        conflicts = self._enrich_with_conflicts(conflicts, sf_records)
        safe = self._enrich_with_conflicts(safe, sf_records)
        logger.info(f"[TRANSFORM] Step 5 complete: enriched all story groups")
        
        # Step 6: Calculate summary and validate counts
        summary = self._build_summary(blocked, conflicts, safe)
        logger.info(f"[TRANSFORM] Step 6 complete: summary={summary}")
        
        # Step 7: Validate counts match
        self._validate_counts(summary, blocked, conflicts, safe)
        
        return {
            "success": True,
            "summary": summary,
            "blocked": blocked,
            "conflicts": conflicts,
            "safe": safe
        }
    
    def _group_by_story(self, sf_records: List[Dict]) -> Dict:
        """Step 1: Group records by story ID"""
        logger.info("[STEP1] Grouping records by story...")
        
        stories_data = {}
        for i, record in enumerate(sf_records):
            story_id = record.get("copado__User_Story__r.Name")
            
            if not story_id:
                logger.warning(f"[STEP1] Record {i} has no story ID, skipping")
                continue
            
            if story_id not in stories_data:
                stories_data[story_id] = {
                    "story_id": story_id,
                    "title": record.get("copado__User_Story__r.copado__User_Story_Title__c"),
                    "jira_key": record.get("jira_key"),
                    "developer": record.get("developer"),
                    "records": []
                }
            
            stories_data[story_id]["records"].append(record)
            logger.debug(f"[STEP1] Added record to story {story_id}, total records: {len(stories_data[story_id]['records'])}")
        
        logger.info(f"[STEP1] Complete: {len(stories_data)} unique stories found")
        for sid, sdata in stories_data.items():
            logger.debug(f"  {sid}: {len(sdata['records'])} records, dev={sdata['developer']}, jira={sdata['jira_key']}")
        
        return stories_data
    
    def _extract_components(self, stories_data: Dict, sf_records: List[Dict]):
        """Step 2: Extract and normalize component data"""
        logger.info("[STEP2] Extracting components...")
        
        comp_id = 0
        for story_id, sdata in stories_data.items():
            logger.debug(f"[STEP2] Processing story {story_id}...")
            
            for record in sdata["records"]:
                api_name = record.get("copado__Metadata_API_Name__c")
                comp_type = record.get("copado__Type__c")
                
                if not api_name or not comp_type:
                    logger.warning(f"[STEP2] Skipping record - missing api_name or type")
                    continue
                
                # Create unique component ID
                comp_id += 1
                cid = f"comp-{comp_id}"
                
                # Extract commit hash (may be null)
                commit_hash = record.get("commit_hash")
                if not commit_hash and record.get("copado__JsonInformation__c"):
                    # Try to extract from JSON
                    commit_hash = self.parse_commit_hash_from_json(record.get("copado__JsonInformation__c"))
                    logger.debug(f"[STEP2] Extracted commit_hash from JSON for {api_name}: {commit_hash}")
                
                # Extract commit URL
                commit_url = self.parse_commit_url_from_json(record.get("copado__JsonInformation__c"))
                if commit_url:
                    logger.debug(f"[STEP2] Extracted commit_url from JSON for {api_name}: {commit_url}")
                
                story_commit_date_str = record.get("copado__Last_Commit_Date__c")
                prod_commit_date_str = record.get("production_commit_date")  # If available

                
                story_commit_date = self._parse_date(story_commit_date_str)
                prod_commit_date = self._parse_date(prod_commit_date_str) if prod_commit_date_str else story_commit_date
                
                # Determine if component is old (story commit < production commit)
                has_old_commit = False
                if story_commit_date and prod_commit_date:
                    has_old_commit = story_commit_date < prod_commit_date
                    logger.debug(f"[STEP2] {api_name}: story_date={story_commit_date}, prod_date={prod_commit_date}, old={has_old_commit}")
                
                component = {
                    "id": cid,
                    "api_name": api_name,
                    "type": comp_type,
                    "status": record.get("copado__Status__c"),
                    "action": record.get("copado__Action__c"),
                    "story_id": story_id,
                    "commit_hash": commit_hash,
                    "commit_url": commit_url,
                    "story_commit_date": story_commit_date_str,
                    "production_commit_date": prod_commit_date_str,
                    "production_story_id": record.get("production_story_id"),
                    "production_story_title": record.get("production_story_title"),
                    "has_old_commit": has_old_commit
                }
                
                self.components[cid] = component
                
                # Track api_name -> stories mapping for conflict detection
                if api_name not in self.component_to_stories:
                    self.component_to_stories[api_name] = []
                if story_id not in self.component_to_stories[api_name]:
                    self.component_to_stories[api_name].append(story_id)
                
                logger.debug(f"[STEP2] Added component {cid}: {api_name} to story {story_id}")
        
        logger.info(f"[STEP2] Complete: {len(self.components)} components extracted")
        logger.info(f"[STEP2] Unique api_names: {len(self.component_to_stories)}")

    
    def _detect_conflicts(self):
        """Step 3: Detect conflicts (same api_name in multiple stories)"""
        logger.info("[STEP3] Detecting conflicts...")
        
        for api_name, story_ids in self.component_to_stories.items():
            if len(story_ids) > 1:
                self.conflicts_map[api_name] = story_ids
                logger.info(f"[STEP3] CONFLICT: {api_name} found in stories: {story_ids}")
            else:
                logger.debug(f"[STEP3] {api_name} unique to story {story_ids[0]}")
        
        logger.info(f"[STEP3] Complete: {len(self.conflicts_map)} components have conflicts")
    
    def _classify_stories(self) -> Tuple[List[str], List[str], List[str]]:
        """Step 4: Classify stories into blocked/conflicts/safe"""
        logger.info("[STEP4] Classifying stories...")
        
        blocked = []
        conflicts = []
        safe = []
        
        for story_id in self.stories.keys():
            logger.debug(f"[STEP4] Classifying story {story_id}...")
            
            # Get all components for this story
            story_components = [c for c in self.components.values() if c["story_id"] == story_id]
            
            # Check if any component has old commit (story < production)
            has_old_component = any(c["has_old_commit"] for c in story_components)
            
            # Check if any component is in conflict (same api_name in multiple stories)
            has_conflict_component = any(
                c["api_name"] in self.conflicts_map 
                for c in story_components
            )
            
            logger.debug(f"[STEP4] {story_id}: has_old={has_old_component}, has_conflict={has_conflict_component}")
            
            # Classification logic
            # BLOCKED: has old components AND has conflicts (worst case)
            if has_old_component and has_conflict_component:
                blocked.append(story_id)
                logger.info(f"[STEP4] {story_id} → BLOCKED (old components + conflicts)")
            
            # CONFLICTING: has conflicts but components are all current/ahead
            elif has_conflict_component and not has_old_component:
                conflicts.append(story_id)
                logger.info(f"[STEP4] {story_id} → CONFLICTS (conflicts but all components current)")
            
            # BLOCKED (no conflicts but has old components): Story behind production
            elif has_old_component and not has_conflict_component:
                blocked.append(story_id)
                logger.info(f"[STEP4] {story_id} → BLOCKED (components behind production)")
            
            # SAFE: No conflicts AND all components are current or ahead
            else:
                safe.append(story_id)
                logger.info(f"[STEP4] {story_id} → SAFE (no conflicts, all components current/ahead)")
        
        logger.info(f"[STEP4] Complete: blocked={len(blocked)}, conflicts={len(conflicts)}, safe={len(safe)}")
        
        return blocked, conflicts, safe
    
    def _enrich_with_conflicts(self, story_ids: List[str], sf_records: List[Dict]) -> List[Dict]:
        """Step 5: Build full story objects with component and conflict details"""
        logger.info(f"[STEP5] Enriching {len(story_ids)} stories with conflict details...")
        
        enriched_stories = []
        
        for story_id in story_ids:
            logger.debug(f"[STEP5] Building story object for {story_id}...")
            
            # Get story data
            story_info = self.stories[story_id]
            
            # Get components for this story
            story_components_data = [c for c in self.components.values() if c["story_id"] == story_id]
            
            # Build component list with conflicts
            components_list = []
            for comp in story_components_data:
                comp_copy = copy.deepcopy(comp)
                
                # Find conflicting stories for this component
                if comp["api_name"] in self.conflicts_map:
                    conflicting_story_ids = [
                        sid for sid in self.conflicts_map[comp["api_name"]] 
                        if sid != story_id
                    ]
                    
                    # Get details of conflicting stories
                    conflicting_details = []
                    for conf_story_id in conflicting_story_ids:
                        if conf_story_id in self.stories:
                            conf_story = self.stories[conf_story_id]
                            conflicting_details.append({
                                "story_id": conf_story_id,
                                "jira_key": conf_story.get("jira_key"),
                                "developer": conf_story.get("developer"),
                                "commit_date": conf_story.get("story_commit_date")
                            })
                            logger.debug(f"[STEP5] {story_id} component {comp['api_name']} conflicts with {conf_story_id}")
                    
                    comp_copy["conflicting_stories"] = conflicting_details
                else:
                    comp_copy["conflicting_stories"] = []
                
                components_list.append(comp_copy)
            
            story_obj = {
                "story_id": story_id,
                "jira_key": story_info.get("jira_key"),
                "title": story_info.get("title"),
                "developer": story_info.get("developer"),
                "component_count": len(components_list),
                "components": components_list
            }
            
            enriched_stories.append(story_obj)
            logger.debug(f"[STEP5] Completed story {story_id} with {len(components_list)} components")
        
        logger.info(f"[STEP5] Complete: {len(enriched_stories)} stories enriched")
        
        return enriched_stories
    
    def _build_summary(self, blocked: List[Dict], conflicts: List[Dict], safe: List[Dict]) -> Dict:
        """Step 6: Build summary with counts"""
        logger.info("[STEP6] Building summary...")
        
        total_stories = len(blocked) + len(conflicts) + len(safe)
        total_components = len(self.components)
        components_in_conflict = len(self.conflicts_map)
        
        summary = {
            "total_stories": total_stories,
            "total_unique_components": total_components,
            "stories_blocked": len(blocked),
            "stories_with_conflicts": len(conflicts),
            "stories_safe": len(safe),
            "components_with_conflicts": components_in_conflict,
            "analyzed_at": datetime.now().isoformat()
        }
        
        logger.info(f"[STEP6] Summary: total_stories={total_stories}, components={total_components}, " +
                   f"blocked={len(blocked)}, conflicts={len(conflicts)}, safe={len(safe)}")
        
        return summary
    
    def _validate_counts(self, summary: Dict, blocked: List[Dict], conflicts: List[Dict], safe: List[Dict]):
        """Step 7: Validate that counts match"""
        logger.info("[STEP7] Validating counts...")
        
        total_from_summary = summary["total_stories"]
        total_from_lists = len(blocked) + len(conflicts) + len(safe)
        
        if total_from_summary == total_from_lists:
            logger.info(f"[STEP7] ✓ COUNT VALID: {total_from_summary} = {total_from_lists}")
        else:
            logger.error(f"[STEP7] ✗ COUNT MISMATCH: summary={total_from_summary}, lists={total_from_lists}")
        
        logger.info(f"[STEP7] Breakdown: blocked={len(blocked)}, conflicts={len(conflicts)}, safe={len(safe)}")
        logger.info(f"[STEP7] Unique components: {summary['total_unique_components']}")
        logger.info(f"[STEP7] Components with conflicts: {summary['components_with_conflicts']}")
    
    def _parse_date(self, date_str: Optional[str]) -> Optional[datetime]:
        """Parse date string to datetime"""
        if not date_str:
            return None
        
        try:
            return datetime.fromisoformat(date_str.replace('Z', '+00:00'))
        except Exception as e:
            logger.debug(f"[PARSE_DATE] Error parsing '{date_str}': {e}")
            return None


# ============================================================
# NEW ROUTE: Use the transformer
# ============================================================

@app.route('/api/analyze-stories', methods=['POST'])
def analyze_stories():
    """
    Transform SF records into blocked/conflicts/safe stories
    
    Input:
    {
      "userStoryNames": "US-001,US-002" OR ["US-001", "US-002"],
      "releaseNames": "Q1-2025" OR ["Q1-2025"]
    }
    """
    
    logger.info("=" * 80)
    logger.info("[ROUTE] POST /api/analyze-stories")
    logger.info("=" * 80)
    
    try:
        payload = request.get_json(force=True, silent=True) or {}
        logger.info(f"[ROUTE] Payload received: {payload}")
        
        # Normalize input
        release_names = payload.get("releaseNames")
        if isinstance(release_names, str):
            release_names = [rn.strip() for rn in release_names.split(",") if rn.strip()] or [release_names]
        
        story_names = payload.get("userStoryNames")
        if isinstance(story_names, str):
            story_names = [sn.strip() for sn in story_names.split(",") if sn.strip()] or [story_names]
        
        if not release_names and not story_names:
            logger.error("[ROUTE] Neither releaseNames nor userStoryNames provided")
            return jsonify({"error": "Provide releaseNames or userStoryNames"}), 400
        
        logger.info(f"[ROUTE] Fetching from Salesforce Client...")
        
        # Fetch metadata, commits, AND production state from SF
        try:
            from salesforce_client import (
                sf_login_from_config,
                fetch_user_story_metadata_by_story_names,
                fetch_story_commits,
                fetch_production_component_state
            )
            from sf_adapter import sf_records_to_rows
            
            sf = sf_login_from_config(payload.get("configJsonPath"))
            
            # Fetch 1: Component metadata per story
            logger.info(f"[ROUTE] Fetching story metadata for: {story_names}")
            raw_metadata = fetch_user_story_metadata_by_story_names(sf, story_names or [])
            logger.info(f"[ROUTE] Got {len(raw_metadata)} metadata records")
            
            # Fetch 2: Commit info per story
            logger.info(f"[ROUTE] Fetching story commits for: {story_names}")
            raw_commits = fetch_story_commits(sf, story_names or [])
            logger.info(f"[ROUTE] Got {len(raw_commits)} commit records")
            
            # Convert metadata to normalized rows
            sf_records = sf_records_to_rows(raw_metadata)
            logger.info(f"[ROUTE] Normalized to {len(sf_records)} rows")
            
            # Fetch 3: Get unique components and their production state (BATCHED - single query)
            unique_components = []
            seen = set()
            for row in sf_records:
                api_name = row.get("copado__Metadata_API_Name__c")
                comp_type = row.get("copado__Type__c")
                
                if api_name and comp_type and (api_name, comp_type) not in seen:
                    seen.add((api_name, comp_type))
                    unique_components.append({
                        "api_name": api_name,
                        "type": comp_type
                    })
            
            logger.info(f"[ROUTE] Found {len(unique_components)} unique components")
            
            # Fetch production state for ALL components in ONE query
            logger.info(f"[ROUTE] Fetching production state for {len(unique_components)} components (batched)")
            production_records = fetch_production_component_state(sf, unique_components)
            logger.info(f"[ROUTE] Got {len(production_records)} production records (may have duplicates)")
            
            # CRITICAL: Sort by commit date DESC to ensure latest is first
            production_records.sort(
                key=lambda r: r.get("copado__Last_Commit_Date__c") or "0000-01-01",
                reverse=True
            )
            
            logger.info(f"[ROUTE] Sorted {len(production_records)} records by copado__Last_Commit_Date__c DESC")
            if production_records:
                logger.debug(f"[ROUTE] First (latest): {production_records[0].get('copado__Metadata_API_Name__c')} | date={production_records[0].get('copado__Last_Commit_Date__c')}")
                if len(production_records) > 1:
                    logger.debug(f"[ROUTE] Last (oldest): {production_records[-1].get('copado__Metadata_API_Name__c')} | date={production_records[-1].get('copado__Last_Commit_Date__c')}")
            
            # Group production records by api_name and keep only the LATEST (first after sort)
            prod_index = {}
            duplicates_skipped = 0
            
            for i, prod_rec in enumerate(production_records):
                api_name = prod_rec.get("copado__Metadata_API_Name__c")
                
                if not api_name:
                    logger.warning(f"[ROUTE] Record {i} missing api_name, skipping")
                    continue
                
                if api_name in prod_index:
                    duplicates_skipped += 1
                    logger.debug(f"[ROUTE] Skipping duplicate for {api_name} (already have latest)")
                    continue
                
                # Handle nested SF response structure
                user_story_rel = prod_rec.get("copado__User_Story__r") or {}
                
                story_id = (
                    user_story_rel.get("Name") or 
                    prod_rec.get("copado__User_Story__r.Name")
                )
                
                story_title = (
                    user_story_rel.get("copado__User_Story_Title__c") or
                    prod_rec.get("copado__User_Story__r.copado__User_Story_Title__c")
                )
                
                last_modified_by = (
                    prod_rec.get("LastModifiedBy.Name") or
                    (prod_rec.get("LastModifiedBy") or {}).get("Name")
                )
                
                commit_date = prod_rec.get("copado__Last_Commit_Date__c")
                
                prod_index[api_name] = {
                    "production_commit_date": commit_date,
                    "production_story_id": story_id,
                    "production_story_title": story_title,
                    "production_modified_by": last_modified_by,
                    "production_modified_date": prod_rec.get("LastModifiedDate")
                }
                
                logger.debug(f"[ROUTE] [Index #{len(prod_index)}] {api_name} | commit_date={commit_date} | story={story_id}")
            
            logger.info(f"[ROUTE] Built production index: {len(prod_index)} unique | {duplicates_skipped} duplicates skipped")
            
            # Build commits index by story_name only (no environment filtering)
            commits_index = {}
            for commit_rec in raw_commits:
                story_name = commit_rec.get("user_story_name")
                
                if story_name:
                    commits_index[story_name] = {
                        "commit_url": commit_rec.get("commit_url"),
                        "commit_sha": commit_rec.get("commit_sha"),
                        "snapshot_commit": commit_rec.get("snapshot_commit")
                    }
                    sha = commit_rec.get("commit_sha")
                    sha_display = sha[:7] if sha else "None"
                    logger.debug(f"[ROUTE] Indexed commit for {story_name}: sha={sha_display}...")
            
            logger.info(f"[ROUTE] Built commits index with {len(commits_index)} entries")
            logger.debug(f"[ROUTE] Commits index keys: {list(commits_index.keys())}")
            
            # Enrich sf_records with BOTH commit data AND production state
            enriched_count = 0
            for row in sf_records:
                story_name = row.get("copado__User_Story__r.Name")
                api_name = row.get("copado__Metadata_API_Name__c")
                
                # Add commit data from commits_index (no environment filtering)
                if story_name:
                    if story_name in commits_index:
                        commit_data = commits_index[story_name]
                        row["commit_url"] = commit_data.get("commit_url")
                        row["commit_hash"] = commit_data.get("commit_sha")
                        logger.debug(f"[ROUTE] Enriched {story_name} with commit data: hash={commit_data.get('commit_sha')[:7] if commit_data.get('commit_sha') else 'None'}...")
                    else:
                        logger.debug(f"[ROUTE] No commit found for {story_name}")
                
                # Add production state from prod_index
                if api_name and api_name in prod_index:
                    prod_data = prod_index[api_name]
                    
                    # OVERWRITE production fields (don't touch commit_hash/commit_url)
                    row["production_commit_date"] = prod_data.get("production_commit_date")
                    row["production_story_id"] = prod_data.get("production_story_id")
                    row["production_story_title"] = prod_data.get("production_story_title")
                    row["production_modified_by"] = prod_data.get("production_modified_by")
                    row["production_modified_date"] = prod_data.get("production_modified_date")
                    
                    enriched_count += 1
                    logger.debug(f"[ROUTE] Enriched {api_name} with production state: story={prod_data.get('production_story_id')}, date={prod_data.get('production_commit_date')}")
                else:
                    if api_name:
                        logger.debug(f"[ROUTE] {api_name} has NO production record (NEW component)")
            
            logger.info(f"[ROUTE] Enriched {enriched_count} rows with production state from prod_index")
            
        except Exception as e:
            logger.error(f"[ROUTE] Error fetching SF data: {str(e)}", exc_info=True)
            return jsonify({
                "success": False,
                "error": f"Failed to fetch SF records: {str(e)}"
            }), 401
        
        # Pre-populate story info from rows
        stories_info = {}
        for row in sf_records:
            sid = row.get("copado__User_Story__r.Name")
            if sid and sid not in stories_info:
                stories_info[sid] = {
                    "story_id": sid,
                    "title": row.get("copado__User_Story__r.copado__User_Story_Title__c"),
                    "jira_key": row.get("jira_key"),
                    "developer": row.get("developer"),
                    "story_commit_date": row.get("copado__Last_Commit_Date__c")
                }
        
        transformer = StoryAnalyzerTransformer()
        transformer.stories = stories_info
        logger.info(f"[ROUTE] Pre-populated {len(transformer.stories)} story info objects")
        
        result = transformer.transform(sf_records)
        
        logger.info("[ROUTE] Transformation complete, returning response")
        logger.info("=" * 80)
        
        return jsonify(result), 200
    
    except Exception as e:
        logger.error(f"[ROUTE] Exception: {str(e)}", exc_info=True)
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500
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

def build_story_component_index(rows):
    """
    Builds indexes for fast story and component lookup
    """
    story_by_name = {}
    story_component_details = {}
    story_component_details_loose = {}

    def _first_non_empty(d, keys):
        for k in keys:
            v = d.get(k)
            if isinstance(v, str) and v.strip():
                return v.strip()
        return None

    for r in rows:
        us_name = r.get("copado__User_Story__r.Name")
        if not us_name:
            continue

        # Extract Jira key with fallbacks
        jira_key = _first_non_empty(r, [
            "jira_key",
            "copado__User_Story__r.copadoccmint__JIRA_key__c",
            "copado__User_Story__r.copado__Jira_Key__c",
        ])

        # Extract developer with fallbacks
        developer = _first_non_empty(r, [
            "developer",
            "copado__User_Story__r.copado__Developer__r.Name",
            "CreatedBy.Name",
            "LastModifiedBy.Name",
        ])

        if us_name not in story_by_name:
            story_by_name[us_name] = {
                "name": us_name,
                "title": r.get("copado__User_Story__r.copado__User_Story_Title__c"),
                "developer": developer,
                "environment": r.get("copado__User_Story__r.copado__Environment__r.Name"),
                "project": r.get("copado__User_Story__r.copado__Project__r.Name") or "Unknown",
                "close_date": r.get("copado__User_Story__r.copado__Close_Date__c"),
                "story_points": r.get("copado__User_Story__r.copado__Story_Points_SFDC__c"),
                "jira_key": jira_key,
            }

        ctype = r.get("copado__Type__c") or ""
        api = r.get("copado__Metadata_API_Name__c") or ""
        mdir = r.get("copado__ModuleDirectory__c") or ""
        strict_key = f"{ctype}|{api}|{mdir}"
        loose_key = f"{ctype}|{api}"

        details = {
            "component_action": r.get("copado__Action__c"),
            "component_status": r.get("copado__Status__c"),
            "component_category": r.get("copado__Category__c"),
            "module_directory": mdir,
            "last_commit_date": r.get("copado__Last_Commit_Date__c"),
            "created_by": r.get("CreatedBy.Name"),
            "last_modified_by": r.get("LastModifiedBy.Name"),
            "created_date": r.get("CreatedDate"),
            "last_modified_date": r.get("LastModifiedDate"),
        }

        story_component_details[(us_name, strict_key)] = details
        story_component_details_loose[(us_name, loose_key)] = details

    return story_by_name, story_component_details, story_component_details_loose

def enrich_conflicts_with_story_detailsbackup(component_conflicts_out,
                                        story_by_name,
                                        story_component_details,
                                        story_component_details_loose,
                                        story_commits_by_name=None):
    """
    Replace involved_stories (ids or mixed dicts/objects) with full dicts including:
      - story fields (developer, environment, jira_key)
      - per-story component fields (action/status/category/module dir/dates)
      - optional commit_url/commit_sha
    """
    def _ensure_comp_keys(conf: dict):
        # returns (strict_key, loose_key)
        t = conf.get("type") or ""
        a = conf.get("api_name") or ""
        m = conf.get("module_directory") or ""
        if not (t or a or m):
            key = conf.get("component_key")
            if key and "|" in key:
                parts = key.split("|", 2)
                t = parts[0]; a = parts[1]; m = parts[2] if len(parts) > 2 else ""
        strict_key = f"{t}|{a}|{m}"
        loose_key  = f"{t}|{a}"
        # write back normalized fields for UI consistency
        conf["type"] = conf.get("type") or t
        conf["api_name"] = conf.get("api_name") or a
        conf["module_directory"] = conf.get("module_directory") or m
        return strict_key, loose_key

    def _to_story_name(item) -> str | None:
        if item is None:
            return None
        if isinstance(item, str):
            s = item.strip()
            return s or None
        if isinstance(item, dict):
            for k in ("name", "user_story_name", "user_story", "story", "Name", "id", "Id", "ID"):
                v = item.get(k)
                if isinstance(v, str) and v.strip():
                    return v.strip()
        for attr in ("name", "user_story_name", "user_story", "story", "id", "Id", "ID"):
            v = getattr(item, attr, None)
            if isinstance(v, str) and v.strip():
                return v.strip()
        return None

    enriched = []

    for conf in (component_conflicts_out or []):
        strict_key, loose_key = _ensure_comp_keys(conf)

        inv = conf.get("involved_stories") or []
        normalized_names = []
        for s in inv:
            n = _to_story_name(s)
            if n:
                normalized_names.append(n)

        inv_detail = []
        for us_name in normalized_names:
            s_base = story_by_name.get(us_name, {}) or {}
            # prefer strict match; fall back to loose
            s_comp = story_component_details.get((us_name, strict_key))
            if not s_comp:
                s_comp = story_component_details_loose.get((us_name, loose_key), {})
            s_commit = (story_commits_by_name or {}).get(us_name, {}) if story_commits_by_name else {}

            # developer fallback if story has none
            developer = s_base.get("developer")
            if not developer:
                developer = s_comp.get("created_by") or s_comp.get("last_modified_by")

            merged = {
                **s_base,
                **s_comp,
                "developer": developer,
                "commit_url": s_commit.get("commit_url"),
                "commit_sha": s_commit.get("commit_sha"),
            }
            inv_detail.append(merged)

        conf["involved_stories"] = inv_detail
        enriched.append(conf)

    return enriched


def enrich_conflicts_with_story_details(conflicts, stories, *args, **kwargs):
    """
    Enrich component conflicts with (a) involved_stories and (b) stories_with_commit_info.story
    using Salesforce rows and optional commit metadata. Non-breaking drop-in.
    """
    import logging
    logger = logging.getLogger("app")

    def _first_nonempty(*vals):
        for v in vals:
            if v is None:
                continue
            s = str(v).strip()
            if s and s != "—":  # Skip em-dash placeholder
                return s
        return None

    def _story_key_from_row(row):
        return (
            row.get("copado__User_Story__r.Name")
            or row.get("name")
            or row.get("id")
            or row.get("story_id")
        )

    def _normalize_to_map(maybe_map, key_func):
        if isinstance(maybe_map, dict):
            return maybe_map
        if isinstance(maybe_map, list):
            out = {}
            for row in maybe_map:
                if isinstance(row, dict):
                    k = key_func(row)
                    if k:
                        out[k] = row
            return out
        return {}

    def _enrich_from_sources(s_name, preexisting=None):
        preexisting = preexisting or {}
        s_base = stories_by_name.get(s_name, {}) or {}
        s_commit = commits_by_name.get(s_name, {}) or {}

        # CRITICAL: Enhanced developer fallback chain
        developer = _first_nonempty(
            preexisting.get("developer"),
            s_base.get("developer"),  # From sf_adapter
            s_base.get("copado__User_Story__r.copado__Developer__r.Name"),
            s_base.get("CreatedBy.Name"),
            s_base.get("created_by"),
            s_base.get("LastModifiedBy.Name"),
            s_base.get("last_modified_by"),
            preexisting.get("created_by"),
            s_commit.get("created_by"),
        )

        # CRITICAL: Enhanced Jira key fallback chain
        jira_key = _first_nonempty(
            preexisting.get("jira_key"),
            s_base.get("jira_key"),  # From sf_adapter or build_story_component_index
            s_base.get("copado__User_Story__r.copadoccmint__JIRA_key__c"),
            s_base.get("copado__User_Story__r.copado__Jira_Key__c"),
        )

        environment = _first_nonempty(
            preexisting.get("environment"),
            s_base.get("copado__User_Story__r.copado__Environment__r.Name"),
            "Unknown",
        )

        project = _first_nonempty(
            preexisting.get("project"),
            s_base.get("copado__User_Story__r.copado__Project__r.Name"),
            "Unknown",
        )

        return {
            **preexisting,
            "name": preexisting.get("name") or preexisting.get("id") or s_name,
            "title": preexisting.get("title") or s_base.get("copado__User_Story__r.copado__User_Story_Title__c"),
            "developer": developer or "—",
            "jira_key": jira_key,
            "environment": environment,
            "project": project,
            "story_points": s_base.get("copado__User_Story__r.copado__Story_Points_SFDC__c"),
            "close_date": s_base.get("copado__User_Story__r.copado__Close_Date__c"),
            "module_directory": preexisting.get("module_directory") or s_base.get("copado__ModuleDirectory__c"),
            "created_by": preexisting.get("created_by") or s_base.get("CreatedBy.Name"),
            "last_modified_by": preexisting.get("last_modified_by") or s_base.get("LastModifiedBy.Name"),
            "created_date": preexisting.get("created_date") or s_base.get("CreatedDate"),
            "last_modified_date": preexisting.get("last_modified_date") or s_base.get("LastModifiedDate"),
            "commit_url": preexisting.get("commit_url") or s_commit.get("commit_url"),
            "commit_sha": preexisting.get("commit_sha") or s_commit.get("commit_sha"),
            "last_commit_date": preexisting.get("last_commit_date") or s_commit.get("commit_date"),
        }

    # Normalize inputs
    story_commits = {}
    if args and len(args) >= 1 and args[0] is not None:
        story_commits = args[0]
    if "story_commits_by_name" in kwargs and kwargs["story_commits_by_name"] is not None:
        story_commits = kwargs["story_commits_by_name"]
    elif "commits" in kwargs and kwargs["commits"] is not None:
        story_commits = kwargs["commits"]

    stories_by_name = _normalize_to_map(stories, key_func=_story_key_from_row)
    commits_by_name = _normalize_to_map(
        story_commits,
        key_func=lambda r: r.get("name") or r.get("id") or r.get("story_id") or r.get("copado__User_Story__r.Name")
    )

    enriched = []
    for conflict in conflicts or []:
        cpy = conflict.copy()

        # Enrich involved_stories
        inv = cpy.get("involved_stories", []) or []
        inv_details = []
        for s in inv:
            if isinstance(s, dict):
                s_name = s.get("name") or s.get("id") or s.get("story_id") or s.get("copado__User_Story__r.Name")
                pre = s
            else:
                s_name = s
                pre = {}
            if s_name and isinstance(s_name, str):
                inv_details.append(_enrich_from_sources(s_name, pre))
        cpy["involved_stories"] = inv_details

        # Enrich stories_with_commit_info
        swci = cpy.get("stories_with_commit_info") or []
        swci_out = []
        for item in swci:
            item_copy = dict(item) if isinstance(item, dict) else {}
            story_obj = item_copy.get("story") or {}
            if "created_by" in item_copy and item_copy.get("created_by"):
                story_obj = {**story_obj, "created_by": item_copy.get("created_by")}
            s_name = story_obj.get("id") or story_obj.get("name") or story_obj.get("story_id")
            if s_name and isinstance(s_name, str):
                item_copy["story"] = _enrich_from_sources(s_name, story_obj)
            else:
                item_copy["story"] = story_obj
            swci_out.append(item_copy)
        cpy["stories_with_commit_info"] = swci_out

        enriched.append(cpy)

    # FIXED: Correct logging format
    logger.debug("enrich_conflicts_with_story_details: enriched %d conflict(s)", len(enriched))
    return enriched


# ===== /api/compare-commits (fast, diffstat-based component change summary) =====


# =============== /api/compare-commits (fast, diffstat-based, timeout-safe) ===============
from flask import request, jsonify
from git_client import BitBucketClient
import component_registry as cr
from urllib.parse import unquote
from requests.exceptions import ReadTimeout, ConnectionError
from config import get_config





def enrich_story_conflicts(story_conflicts, story_by_name):
    """
    Enrich story_conflicts with developer and jira_key from story_by_name index.
    
    Args:
        story_conflicts: List of story conflict dicts with story1_id, story2_id, etc.
        story_by_name: Dict mapping story name -> story details (from build_story_component_index)
    
    Returns:
        Enriched list of story conflicts with developer and jira_key populated
    """
    enriched = []
    
    for conflict in story_conflicts or []:
        enriched_conflict = conflict.copy()
        
        # Get story IDs
        story1_id = conflict.get("story1_id")
        story2_id = conflict.get("story2_id")
        
        # Enrich story1
        if story1_id and story1_id in story_by_name:
            story1_data = story_by_name[story1_id]
            enriched_conflict["story1_developer"] = story1_data.get("developer")
            enriched_conflict["story1_jira_key"] = story1_data.get("jira_key")
            enriched_conflict["story1_title"] = story1_data.get("title")
        
        # Enrich story2
        if story2_id and story2_id in story_by_name:
            story2_data = story_by_name[story2_id]
            enriched_conflict["story2_developer"] = story2_data.get("developer")
            enriched_conflict["story2_jira_key"] = story2_data.get("jira_key")
            enriched_conflict["story2_title"] = story2_data.get("title")
        
        enriched.append(enriched_conflict)
    
    return enriched


# ---------- Route (replace your existing /api/analyze-sf with this) ----------
@app.route('/api/analyze-sf', methods=['POST'])
def analyze_salesforce_stub():
    """
    Online path: validate input -> fetch from Salesforce -> adapt to rows ->
    write a CSV we can inspect -> reuse existing CSV parser -> detect conflicts -> enrich result.
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

    # Conflict detection
    detector = ConflictDetector(parsed.user_stories)
    component_conflicts = detector.detect_conflicts()
    story_conflicts = detector.analyze_story_to_story_conflicts()

    # Summary (optional)
    summary = detector.get_conflict_summary(component_conflicts) if hasattr(detector, "get_conflict_summary") else {
        "total_conflicts": len(component_conflicts),
        "severity_breakdown": {},
        "affected_stories": 0,
        "avg_risk_score": 0
    }

    # JSON-safe serialization (avoid double conversion bug)
    component_conflicts_out = json_safe(component_conflicts)
    story_conflicts_out = json_safe(story_conflicts)
    summary_out = json_safe(summary)

    # ---------- Enrichment: full per-story details for each conflict ----------
    # Build fast lookup indexes from the SF rows we already fetched
    # NOTE: your build_story_component_index(rows) must return THREE values now
    story_by_name, story_component_details, story_component_details_loose = build_story_component_index(rows)

    # Optional: fetch Git commit link/SHA per story (batched); best-effort only
    if story_names:
        candidate_story_names = story_names
    else:
        candidate_story_names = [
            getattr(us, "id", getattr(us, "name", None)) for us in parsed.user_stories
            if getattr(us, "id", None) or getattr(us, "name", None)
        ]
    candidate_story_names = [s for s in candidate_story_names if s]

    story_commits_by_name = {}
    try:
        if candidate_story_names:
            _sc = fetch_story_commits(sf, candidate_story_names)
            story_commits_by_name = {sc["user_story_name"]: sc for sc in _sc if sc.get("user_story_name")}
    except Exception:
        story_commits_by_name = {}

    # Replace involved_stories (ids/objects) with full dicts (developer, dates, action/status, module dir, commit URL/SHA)
    component_conflicts_out = enrich_conflicts_with_story_details(
    component_conflicts_out,
    story_by_name,
    story_commits_by_name=story_commits_by_name,
)

    # ---------- A) Add latest owner + deploy order recommendation ----------
    for c in component_conflicts_out:
        swci = c.get("stories_with_commit_info") or []
        timeline = []
        for item in swci:
            story_obj = (item or {}).get("story") or {}
            sid = story_obj.get("id") or story_obj.get("name")
            cdate = (item or {}).get("commit_date")
            if sid and cdate:
                timeline.append((sid, cdate))
        # Sort ascending by ISO date string (oldest -> newest)
        timeline.sort(key=lambda x: x[1])
        if timeline:
            deploy_order = [sid for sid, _ in timeline]
            latest_owner = deploy_order[-1]
            c["latest_owner"] = latest_owner
            c["deploy_order_hint"] = deploy_order
            c["recommendation"] = {
                "action": "DEPLOY LATEST STORY LAST",
                "steps": [
                    ("Deploy " + ", then ".join(deploy_order[:-1])) if len(deploy_order) > 1 else f"Deploy {deploy_order[0]}",
                    f"Deploy {latest_owner} last",
                    "Smoke-test the component after final deploy"
                ],
                "priority": "LOW"
            }
    
    
    
        # ---------- B) Fill missing developer names in involved_stories ----------
    for c in component_conflicts_out:
        # 1) Build helper maps from SWCI
        dev_by_story = {}
        created_by_map = {}
        for item in (c.get("stories_with_commit_info") or []):
            story_obj = (item or {}).get("story") or {}
            sid = story_obj.get("id") or story_obj.get("name")
            if sid:
                if story_obj.get("developer"):
                    dev_by_story[sid] = story_obj.get("developer")
                cb = item.get("created_by")
                if cb:
                    created_by_map[sid] = cb

        # 2) Precedence: SWCI developer → CreatedBy.Name → LastModifiedBy.Name → SWCI.created_by
        for s in c.get("involved_stories", []):
            if s.get("developer"):
                continue
            us_name = s.get("name")
            if us_name and us_name in dev_by_story:
                s["developer"] = dev_by_story[us_name]
                continue
            if s.get("created_by"):
                s["developer"] = s["created_by"]
                continue
            if s.get("last_modified_by"):
                s["developer"] = s["last_modified_by"]
                continue
            if us_name and us_name in created_by_map:
                s["developer"] = created_by_map[us_name]

    # ---------- Jira backfill (place this RIGHT HERE) ----------
    for c in component_conflicts_out:
        for s in c.get("involved_stories", []):
            if not s.get("jira_key"):
                us_name = s.get("name")
                if us_name and us_name in story_by_name:
                    jk = story_by_name[us_name].get("jira_key")
                    if jk:
                        s["jira_key"] = jk

   
    # ---------- ENRICH COMPONENT CONFLICTS ----------
    component_conflicts_out = enrich_conflicts_with_story_details(
        component_conflicts_out,
        story_by_name,
        story_commits_by_name=story_commits_by_name,
    )
    story_conflicts_out = enrich_story_conflicts(story_conflicts_out, story_by_name)

  

    # ---------- Return payload ----------
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