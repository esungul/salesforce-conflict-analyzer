"""
BitBucket Git Client
Fetches code from repository for diff comparison
"""
import os
import requests
from typing import Optional, Dict, List
from dotenv import load_dotenv
import component_registry as cr
from urllib.parse import unquote,quote
import re
GUID_RE = re.compile(r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}")
from component_registry import vlocity_bundle_folder_candidates
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from requests.adapters import HTTPAdapter
from config import get_config
from urllib3.util.retry import Retry
log = logging.getLogger(__name__)









def strip_type_prefix(name: str, component_type: str) -> str:
    pfx = f"{component_type}."
    return name[len(pfx):] if name.startswith(pfx) else name

def slug(s: str) -> str:
    # keep underscores (important for OID/ODD), hyphenate spaces, strip parens
    s = s.replace("(", "").replace(")", "")
    s = re.sub(r"\s+", "-", s.strip())
    # collapse multiple dashes
    s = re.sub(r"-{2,}", "-", s)
    return s




# Load environment variables
load_dotenv()

class BitBucketClient:
    """Client for interacting with BitBucket API v2"""
    
    from component_registry import vlocity_bundle_folder_candidates
     
      
    
    
    def get_diffstat(self, ref_a: str, ref_b: str, pagelen: int = 200) -> list[dict]:
        """
        Fetch Bitbucket diffstat between two refs (branch names or commit SHAs).
        Returns a flat list of entries with keys: status, old_path, new_path.
        """
        if not ref_a or not ref_b:
            return []

        spec = f"{ref_a}..{ref_b}"
        url = f"{self.base_url}/diffstat/{spec}"
        params = {"pagelen": int(pagelen)}

        items: list[dict] = []
        try:
            while url:
                resp = self.session.get(url, headers=self._get_headers(), params=params, timeout=self.timeout)
                if resp.status_code == 404:
                    # No diff found (e.g., refs invalid) — return empty
                    return []
                resp.raise_for_status()
                data = resp.json() or {}
                for v in data.get("values", []) or []:
                    status = v.get("status")
                    old_path = (v.get("old") or {}).get("path")
                    new_path = (v.get("new") or {}).get("path")
                    items.append({
                        "status": status,
                        "old_path": old_path,
                        "new_path": new_path
                    })
                url = data.get("next")
                params = None  # 'next' already includes query params
        except Exception as e:
            self.logger.error("get_diffstat(%s..%s) failed: %s", ref_a, ref_b, e)
            return []

        return items

    
    

    def verify_commit_in_branch(self, commit_hash: str, branch: str = "master") -> dict:
        """
        Check if a commit exists in a branch
        """
        url = f"{self.base_url}/commit/{commit_hash}"
        
        try:
            response = requests.get(url, headers=self._get_headers())
            
            if response.status_code == 200:
                commit_data = response.json()
                
                # Check if commit is in the branch
                branches_url = f"{self.base_url}/commit/{commit_hash}/branches"
                branches_response = requests.get(branches_url, headers=self._get_headers())
                
                in_branch = False
                if branches_response.status_code == 200:
                    branches = branches_response.json().get('values', [])
                    in_branch = any(b.get('name') == branch for b in branches)
                
                return {
                    'exists': True,
                    'in_branch': in_branch,
                    'commit_hash': commit_hash,
                    'author': commit_data.get('author', {}).get('raw'),
                    'date': commit_data.get('date'),
                    'message': commit_data.get('message', '').split('\n')[0]
                }
            else:
                return {
                    'exists': False,
                    'in_branch': False,
                    'commit_hash': commit_hash
                }
                
        except Exception as e:
            return {
                'exists': False,
                'error': str(e)
        }
    
    def get_commit_changes(self, commit_hash: str) -> dict:
        """
        Get what changed in a specific commit
        
        Returns:
            Files changed, lines added/removed, diff content
        """
        url = f"{self.base_url}/commit/{commit_hash}"
        
        try:
            response = requests.get(url, headers=self._get_headers())
            
            if response.status_code != 200:
                return {
                    'success': False,
                    'error': f'Commit not found: {commit_hash}'
                }
            
            commit_data = response.json()
            
            # Get diff for this commit
            diff_url = f"{self.base_url}/commit/{commit_hash}/diff"
            diff_response = requests.get(diff_url, headers=self._get_headers())
            
            files_changed = []
            total_additions = 0
            total_deletions = 0
            
            if diff_response.status_code == 200:
                diff_data = diff_response.json()
                
                # Parse diff for each file
                for diff in diff_data.get('values', []):
                    file_path = diff.get('new', {}).get('path') or diff.get('old', {}).get('path')
                    
                    # Count additions/deletions
                    additions = 0
                    deletions = 0
                    changed_lines = []
                    
                    # Parse hunks to find changed lines
                    for hunk in diff.get('hunks', []):
                        segments = hunk.get('segments', [])
                        for segment in segments:
                            seg_type = segment.get('type')
                            lines = segment.get('lines', [])
                            
                            if seg_type == 'ADDED':
                                additions += len(lines)
                                # Get line numbers
                                start_line = hunk.get('new_start', 0)
                                changed_lines.append({
                                    'type': 'added',
                                    'start': start_line,
                                    'end': start_line + len(lines)
                                })
                            elif seg_type == 'REMOVED':
                                deletions += len(lines)
                                start_line = hunk.get('old_start', 0)
                                changed_lines.append({
                                    'type': 'removed',
                                    'start': start_line,
                                    'end': start_line + len(lines)
                                })
                    
                    total_additions += additions
                    total_deletions += deletions
                    
                    files_changed.append({
                        'path': file_path,
                        'additions': additions,
                        'deletions': deletions,
                        'changed_lines': changed_lines
                    })
            
            return {
                'success': True,
                'commit_hash': commit_hash,
                'short_hash': commit_hash[:7],
                'author': commit_data.get('author', {}).get('raw'),
                'date': commit_data.get('date'),
                'message': commit_data.get('message', '').split('\n')[0],
                'files_changed': files_changed,
                'total_files': len(files_changed),
                'total_additions': total_additions,
                'total_deletions': total_deletions,
                'summary': f"+{total_additions} -{total_deletions}"
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
    
    def check_commit_ancestry(self, older_commit: str, newer_commit: str) -> dict:
        """
        Check if newer_commit includes older_commit changes
        
        Returns:
            is_ancestor: True if newer includes older
            relationship: Description of relationship
        """
        # BitBucket API to check commit parents
        url = f"{self.base_url}/commit/{newer_commit}"
        
        try:
            response = requests.get(url, headers=self._get_headers())
            
            if response.status_code != 200:
                return {
                    'success': False,
                    'error': f'Commit not found: {newer_commit}'
                }
            
            commit_data = response.json()
            parents = commit_data.get('parents', [])
            
            # Check if older_commit is in the ancestry
            # We need to walk the parent chain
            is_ancestor = self._is_commit_ancestor(older_commit, newer_commit)
            
            if is_ancestor:
                relationship = "INCLUDES"
                message = f"✅ Commit {newer_commit[:7]} includes changes from {older_commit[:7]}"
                safe_order = f"Safe to deploy newer commit only"
            else:
                relationship = "SEPARATE"
                message = f"⚠️ Commits are on separate branches - changes will conflict"
                safe_order = f"Deploy {older_commit[:7]} first, then {newer_commit[:7]}"
            
            return {
                'success': True,
                'is_ancestor': is_ancestor,
                'relationship': relationship,
                'message': message,
                'recommended_order': safe_order,
                'older_commit': older_commit[:7],
                'newer_commit': newer_commit[:7]
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }

    def list_folder_files(self, folder_path: str, branch: str = "master") -> list:
        """
        List all files in a folder (paths only).
        """
        if not folder_path:
            return []
        cache_key = (branch, folder_path)
        if cache_key in self._cache_list_folder_files:
            return self._cache_list_folder_files[cache_key]

        url = f"{self.base_url}/src/{quote(branch, safe='')}/{quote(folder_path, safe='/')}"
        try:
            response = self.session.get(url, headers=self._get_headers(), timeout=self.timeout)
            if response.status_code == 200:
                data = response.json()
                files = []
                for item in data.get('values', []) or []:
                    if item.get('type') == 'commit_file':
                        p = item.get('path')
                        if isinstance(p, str):
                            files.append(p)
                self._cache_list_folder_files[cache_key] = files
                return files
            elif response.status_code == 404:
                self._cache_list_folder_files[cache_key] = []
                return []
            else:
                self.logger.warning("list_folder_files %s %s -> %s", branch, folder_path, response.status_code)
                self._cache_list_folder_files[cache_key] = []
                return []
        except Exception as e:
            self.logger.error("list_folder_files error: %s", e)
            self._cache_list_folder_files[cache_key] = []
            return []

    def get_bundle_diff(self, component_name: str, component_type: str,
                        prod_branch: str = "master", uat_branch: str = "uatsfdc") -> dict:
        """
        Get diff for all files in a component bundle (fast, parallel).
        Falls back to single-file diff for non-bundle types.
        """

        # Non-bundle? delegate
        bundle_kinds = {
            'OmniScript','IntegrationProcedure','DataRaptor','VlocityUILayout','VlocityCard',
            'CalculationProcedure','CalculationMatrix','Product2','OrchestrationItemDefinition',
            'OrchestrationDependencyDefinition','CalculationMatrixVersion','Catalog','PriceList','AttributeCategory'
        }
        if component_type not in bundle_kinds:
            return self.get_component_diff(component_name, component_type, prod_branch, uat_branch)

        folder = f"vlocity/{component_type}/{component_name}"

        # list files for both branches in parallel
        with ThreadPoolExecutor(max_workers=min(self.max_workers, 8)) as exe:
            f_prod = exe.submit(self.list_folder_files, folder, prod_branch)
            f_uat  = exe.submit(self.list_folder_files, folder, uat_branch)
            prod_files = f_prod.result() or []
            uat_files  = f_uat.result() or []

        all_files = sorted(set(prod_files + uat_files))
        self.logger.info("bundle %s/%s -> %d files", component_type, component_name, len(all_files))

        if not all_files:
            return {
                'component_name': component_name,
                'component_type': component_type,
                'is_bundle': True,
                'bundle_files': [],
                'has_changes': False,
                'file_path': folder,
                'total_files': 0
            }

        def _diff_one(path: str) -> dict:
            # fetch both contents (sequential inside task; tasks run in parallel)
            prod_content = self.get_file_content(path, prod_branch)
            uat_content  = self.get_file_content(path, uat_branch)
            exists_prod = prod_content is not None
            exists_uat  = uat_content is not None
            has_changes = False
            if exists_prod and exists_uat:
                has_changes = (prod_content != uat_content)
            elif exists_prod != exists_uat:
                has_changes = True

            return {
                'file_name': path.split('/')[-1],
                'file_path': path,
                'exists_in_prod': exists_prod,
                'exists_in_uat': exists_uat,
                'has_changes': has_changes,
                'production_code': prod_content if exists_prod else None,
                'uat_code': uat_content if exists_uat else None
            }

        bundle_files = []
        has_any_changes = False
        # Parallelize across files (tune workers)
        with ThreadPoolExecutor(max_workers=self.max_workers) as exe:
            futures = {exe.submit(_diff_one, p): p for p in all_files}
            for fut in as_completed(futures):
                row = fut.result()
                bundle_files.append(row)
                has_any_changes = has_any_changes or row['has_changes']

        # Keep deterministic order by path
        bundle_files.sort(key=lambda r: r['file_path'])

        return {
            'component_name': component_name,
            'component_type': component_type,
            'is_bundle': True,
            'bundle_files': bundle_files,
            'has_changes': has_any_changes,
            'file_path': folder,
            'total_files': len(bundle_files)
        }
    
     

    
    def _is_commit_ancestor(self, ancestor_hash: str, descendant_hash: str, max_depth: int = 50) -> bool:
        """
        Check if ancestor_hash is an ancestor of descendant_hash
        by walking parent chain
        """
        if ancestor_hash == descendant_hash:
            return True
        
        visited = set()
        queue = [descendant_hash]
        depth = 0
        
        while queue and depth < max_depth:
            current = queue.pop(0)
            
            if current in visited:
                continue
            visited.add(current)
            
            # Get commit info
            url = f"{self.base_url}/commit/{current}"
            try:
                response = requests.get(url, headers=self._get_headers())
                if response.status_code == 200:
                    commit_data = response.json()
                    parents = commit_data.get('parents', [])
                    
                    for parent in parents:
                        parent_hash = parent.get('hash', '')
                        if parent_hash.startswith(ancestor_hash):
                            return True
                        queue.append(parent_hash)
            except:
                pass
            
            depth += 1
        
        return False    
    
   
    def __init__(
        self,
        logger: Optional[logging.Logger] = None,
        *,
        workspace: Optional[str] = None,
        repo: Optional[str] = None,
        token: Optional[str] = None,
        base_url: Optional[str] = None,
        session: Optional[requests.Session] = None,
        timeout: Optional[float] = None,
        max_workers: Optional[int] = None,
    ):
        """
        Single, unified constructor:
        - Reads defaults from config.py (which reads your env: API_MAX_WORKERS, BITBUCKET_MAX_WORKERS, BITBUCKET_POOL_MAXSIZE, BITBUCKET_TIMEOUT, etc.)
        - Allows per-instance overrides via kwargs (backward-compatible).
        - Sets up a pooled HTTP session with retries and Authorization header.
        - Initializes per-instance caches (intended: one client per request).
        """
        cfg = get_config()

        # ---- logger ----
        self.logger = logger or logging.getLogger(__name__)
        if not self.logger.handlers:
            self.logger.addHandler(logging.NullHandler())

        # ---- core repo coordinates (cfg → env → override already handled by kwargs) ----
        self.workspace = workspace or cfg.BITBUCKET_WORKSPACE or os.getenv("BITBUCKET_WORKSPACE")
        self.repo      = repo      or cfg.BITBUCKET_REPO_SLUG  or os.getenv("BITBUCKET_REPO")
        self.token     = token     or cfg.BITBUCKET_TOKEN      or os.getenv("BITBUCKET_TOKEN")

        if not self.workspace or not self.repo:
            raise ValueError("Bitbucket workspace/repo not configured. Set BITBUCKET_WORKSPACE and BITBUCKET_REPO (or configure in config.py).")

        # API root (support on-prem override)
        api_root = (cfg.BITBUCKET_BASE_URL or "").strip().rstrip("/") or "https://api.bitbucket.org/2.0"
        self.base_url = base_url or f"{api_root}/repositories/{self.workspace}/{self.repo}"

        # performance knobs
        self.timeout     = float(timeout if timeout is not None else cfg.BITBUCKET_TIMEOUT)
        self.max_workers = int(max_workers if max_workers is not None else cfg.BITBUCKET_MAX_WORKERS)
        pool_max         = int(cfg.BITBUCKET_POOL_MAXSIZE)

        # ---- HTTP session (inject or create) ----
        if session is not None:
            self.session = session
        else:
            self.session = requests.Session()
            retry = Retry(
                total=3, connect=3, read=3,
                backoff_factor=0.3,
                status_forcelist=(429, 500, 502, 503, 504),
                allowed_methods=frozenset({"GET", "POST"}),
                raise_on_status=False,
            )
            adapter = HTTPAdapter(pool_connections=pool_max, pool_maxsize=pool_max, max_retries=retry)
            self.session.mount("http://", adapter)
            self.session.mount("https://", adapter)

            # Default headers once, on the session
            headers = {"Accept": "application/json"}
            if self.token:
                headers["Authorization"] = f"Bearer {self.token}"
            else:
                self.logger.warning("BITBUCKET_TOKEN not set; private repo calls may fail.")
            self.session.headers.update(headers)

        # ---- per-instance caches (cleared when client is discarded) ----
        self._cache_list_folder: Dict[tuple, object] = {}
        self._cache_list_folder_files: Dict[tuple, List[str]] = {}
        self._cache_get_file_content: Dict[tuple, Optional[str]] = {}
        self._cache_get_file_commits: Dict[tuple, List[Dict]] = {}

        self.closed = False

    def _get_headers(self) -> Dict[str, str]:
        """
        Kept for backward compatibility if other methods call it.
        We already set headers on the session; this returns the same values.
        """
        base = {"Accept": "application/json"}
        if self.token:
            base["Authorization"] = f"Bearer {self.token}"
        return base

    def close(self):
        if getattr(self, "session", None) and not getattr(self, "closed", False):
            try:
                self.session.close()
            finally:
                self.closed = True
    
    def _get_headers(self) -> Dict[str, str]:
        """Get authentication headers"""
        return {
            "Authorization": f"Bearer {self.token}",
            "Accept": "application/json"
        }
  
    def get_file_content(self, file_path: str, branch: str = "master") -> Optional[str]:
        """
        Get file content from repository. Returns None on 404.
        """
        if not file_path:
            return None

        cache_key = (branch, file_path)
        if cache_key in self._cache_get_file_content:
            return self._cache_get_file_content[cache_key]

        url = f"{self.base_url}/src/{quote(branch, safe='')}/{quote(file_path, safe='/')}"
        try:
            response = self.session.get(url, headers=self._get_headers(), timeout=self.timeout)
            if response.status_code == 200:
                self._cache_get_file_content[cache_key] = response.text
                return response.text
            elif response.status_code == 404:
                self._cache_get_file_content[cache_key] = None
                return None
            else:
                self.logger.warning("get_file_content %s %s -> %s", branch, file_path, response.status_code)
                self._cache_get_file_content[cache_key] = None
                return None
        except Exception as e:
            self.logger.error("get_file_content error: %s", e)
            self._cache_get_file_content[cache_key] = None
            return None

    def get_diffstat(self, commit_sha: str) -> dict:
        """Get diffstat for a commit - returns file changes with paths"""
        url = f"{self.base_url}/repositories/{self.workspace}/{self.repo}/diffstat/{commit_sha}"
        
        try:
            response = self.session.get(url)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            self.logger.error(f"Failed to get diffstat for commit {commit_sha}: {e}")
            return {}
    def get_file_content_smart(self, component_name: str, component_type: str, branch: str = "master") -> tuple:
        """
        Smart file retrieval - tries multiple possible paths
        
        Returns:
            (content, actual_path) - content of file and path where it was found
        """
        possible_paths = self.get_possible_paths(component_name, component_type)
        
        for path in possible_paths:
            content = self.get_file_content(path, branch)
            if content is not None:
                print(f"✅ Found: {path}")
                return (content, path)
        
        print(f"❌ Not found in any path: {component_name} ({component_type})")
        print(f"   Tried: {', '.join(possible_paths)}")
        return (None, None)
    
    def get_possible_paths(self, component_name: str, component_type: str) -> list:
        """
        Get all possible paths where component might exist
        Returns list of paths to try in order
        """

       # if '.' in component_name:
       #  component_name = component_name.split('.', 1)[1]
        
        paths = []
        reg = cr.candidates_for_single_file(component_name, component_type)
        print(f"We are in reg {reg}")
        
        
        if reg:
            paths.extend(reg)
            

        
        # Salesforce metadata - try multiple structures
        if component_type == 'ApexClass':
            paths.extend([
                f"classes/{component_name}.cls",
                f"force-app/main/default/classes/{component_name}.cls",
                f"src/classes/{component_name}.cls"
            ])
        
        elif component_type == 'lwc' or component_type == 'LightningComponentBundle':
            # LWC is a folder with multiple files
            paths.extend([
            f"lwc/{component_name}/{component_name}.js",
            f"force-app/main/default/lwc/{component_name}/{component_name}.js",
            f"src/lwc/{component_name}/{component_name}.js"
            ])

        elif component_type == 'aura' or component_type == 'AuraDefinitionBundle':
            # Aura components
             paths.extend([
             f"aura/{component_name}/{component_name}.cmp",
             f"force-app/main/default/aura/{component_name}/{component_name}.cmp",
            f"src/aura/{component_name}/{component_name}.cmp"
         ])
        
        elif component_type == 'ApexTrigger':
            paths.extend([
                f"triggers/{component_name}.trigger",
                f"force-app/main/default/triggers/{component_name}.trigger",
                f"src/triggers/{component_name}.trigger"
            ])
        
        elif component_type == 'PermissionSet':
            paths.extend([
                f"permissionsets/{component_name}.permissionset-meta.xml",
                f"force-app/main/default/permissionsets/{component_name}.permissionset-meta.xml"
            ])
        
        # Vlocity components - try multiple structures
        elif component_type in ['DataRaptor', 'IntegrationProcedure', 'OmniScript', 
                                'VlocityCard', 'CalculationProcedure', 'CalculationMatrix']:
            paths.extend([
                f"vlocity/{component_type}/{component_name}/{component_name}_DataPack.json",
                f"vlocity/{component_type.lower()}/{component_name}/{component_name}_DataPack.json",
                f"{component_type}/{component_name}/{component_name}_DataPack.json"
            ])
        
        else:
            # Unknown type - try all common patterns
            
            # First, check if it's actually a known type with wrong name
            type_lower = component_type.lower()
            
            # Try LWC patterns
            if 'lwc' in type_lower or 'lightning' in type_lower:
                paths.extend([
                    f"lwc/{component_name}/{component_name}.js",
                    f"force-app/main/default/lwc/{component_name}/{component_name}.js"
                ])
            
            # Try Vlocity patterns (for misspelled or variant names)
            paths.extend([
                f"vlocity/{component_type}/{component_name}/{component_name}_DataPack.json",
                f"vlocity/DataRaptor/{component_name}/{component_name}_DataPack.json",
                f"vlocity/IntegrationProcedure/{component_name}/{component_name}_DataPack.json",
                f"vlocity/OmniScript/{component_name}/{component_name}_*.json"
            ])
            
            # Try Aura
            paths.extend([
                f"aura/{component_name}/{component_name}.cmp",
                f"force-app/main/default/aura/{component_name}/{component_name}.cmp"
            ])
            
            # Try generic Salesforce
            paths.extend([
                f"{component_type}/{component_name}",
                f"force-app/main/default/{type_lower}/{component_name}"
            ])
                
        return paths
 
    def build_component_path(self, component_name: str, component_type: str) -> str:
        """
        Build file path for component (custom repo structure)
        
        Repository structure:
        - Vlocity: vlocity/{Type}/{Name}/{Name}_DataPack.json
        - Salesforce: classes/{Name}.cls, triggers/{Name}.trigger, etc.
        
        Args:
            component_name: Component name
            component_type: Component type
        
        Returns:
            File path in repository
        """
        # Remove type prefix if present
        if '.' in component_name:
            component_name = component_name.split('.', 1)[1]
        
        # Salesforce metadata types (flat structure)
        if component_type == 'ApexClass':
            return f"classes/{component_name}.cls"
        
        elif component_type == 'ApexTrigger':
            return f"triggers/{component_name}.trigger"
        
        elif component_type == 'ApexPage':
            return f"pages/{component_name}.page"
        
        elif component_type == 'ApexComponent':
            return f"components/{component_name}.component"
        
        elif component_type == 'PermissionSet':
            return f"permissionsets/{component_name}.permissionset"
        
        elif component_type == 'Flow':
            return f"flows/{component_name}.flow-meta.xml"
        
        elif component_type == 'CustomObject':
            return f"objects/{component_name}.object-meta.xml"
        
        elif component_type == 'Layout':
            return f"layouts/{component_name}.layout-meta.xml"
        
        elif component_type == 'Profile':
            return f"profiles/{component_name}.profile-meta.xml"
        
        else:
            # Vlocity components
            return f"vlocity/{component_type}/{component_name}/{component_name}_DataPack.json"
     
    def get_component_diff_details(self, component_name: str, component_type: str,branch1: str = "master", branch2: str = "uatsfdc") -> dict:
        """
        Get detailed diff for a component between two branches
        Shows which specific files changed
        
        Args:
            component_name: Component name
            component_type: Component type (lwc, OmniScript, etc.)
            branch1: First branch (usually production)
            branch2: Second branch (usually UAT)
        
        Returns:
            Dictionary with changed files and their status
        """
        if cr.is_bundle(component_type):
            folder = cr.folder_for_bundle(component_name, component_type)
            if folder:
                # Build folder path based on component type
                if component_type == 'lwc':
                    folder_path = f"lwc/{component_name}/"
                elif component_type == 'OmniScript':
                    folder_path = f"vlocity/OmniScript/{component_name}/"
                elif component_type == 'IntegrationProcedure':
                    folder_path = f"vlocity/IntegrationProcedure/{component_name}/"
                elif component_type == 'DataRaptor':
                    folder_path = f"vlocity/DataRaptor/{component_name}/"
                else:
                    # Single file components
                    folder_path = self.build_component_path(component_name, component_type)
                
                # Use BitBucket commits API to compare
                url = f"{self.base_url}/commits/{branch2}"
                params = {
                    'path': folder_path,
                    'pagelen': 50  # Get recent commits
                }
                
        try:
            response = requests.get(url, headers=self._get_headers(), params=params)
            
            if response.status_code != 200:
                return {
                    'success': False,
                    'error': f"Failed to get commits: {response.status_code}"
                }
            
            commits_data = response.json()
            commits = commits_data.get('values', [])
            
            if not commits:
                return {
                    'success': True,
                    'has_changes': False,
                    'message': 'No commits found for this component'
                }
            
            # Get latest commit
            latest_commit = commits[0]
            
            # Get diffstat (shows which files changed)
            diffstat_url = f"{self.base_url}/diffstat/{latest_commit['hash']}"
            diffstat_response = requests.get(diffstat_url, headers=self._get_headers())
            
            if diffstat_response.status_code == 200:
                diffstat = diffstat_response.json()
                
                # Filter to only files in our component folder
                changed_files = []
                for file_stat in diffstat.get('values', []):
                    file_path = file_stat.get('old', {}).get('path') or file_stat.get('new', {}).get('path')
                    
                    if file_path and folder_path in file_path:
                        changed_files.append({
                            'file': file_path,
                            'lines_added': file_stat.get('lines_added', 0),
                            'lines_removed': file_stat.get('lines_removed', 0),
                            'status': file_stat.get('status', 'modified')
                        })
                
                return {
                    'success': True,
                    'has_changes': len(changed_files) > 0,
                    'changed_files': changed_files,
                    'latest_commit': {
                        'hash': latest_commit['hash'][:8],
                        'message': latest_commit['message'],
                        'author': latest_commit['author']['raw'],
                        'date': latest_commit['date']
                    }
                }
            
            return {
                'success': True,
                'has_changes': True,
                'message': 'Component has commits but diffstat unavailable'
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
   
    def get_component_diff(self, component_name: str, component_type: str, 
                      prod_branch: str = "master", uat_branch: str = "uatsfdc") -> dict:
        """
        Get code diff between two branches for a component
        Uses smart path detection to find files in any repo structure
        
        Args:
            component_name: Component name
            component_type: Component type
            prod_branch: Production branch name
            uat_branch: UAT branch name
        
        Returns:
            Dictionary with diff information
        """
        try:
            # Use smart path detection (tries multiple locations)
            prod_content, prod_path = self.get_file_content_smart(
                component_name,
                component_type,
                branch=prod_branch
            )
            
            uat_content, uat_path = self.get_file_content_smart(
                component_name,
                component_type,
                branch=uat_branch
            )
            
            # Use the path that was found
            file_path = prod_path or uat_path
            
            # If neither found, build a default path for error message
            if not file_path:
                file_path = self.build_component_path(component_name, component_type)
            
            # Check if content exists and differs
            has_changes = False
            if prod_content and uat_content:
                has_changes = prod_content != uat_content
            
            return {
                'component_name': component_name,
                'component_type': component_type,
                'production_code': prod_content,
                'uat_code': uat_content,
                'has_changes': has_changes,
                'changes_detected': has_changes,  # Alias for compatibility
                'file_path': file_path,
                'production_exists': prod_content is not None,
                'uat_exists': uat_content is not None,
                'prod_branch': prod_branch,
                'uat_branch': uat_branch
            }
            
        except Exception as e:
            print(f"Error in get_component_diff: {str(e)}")
            return {
                'component_name': component_name,
                'component_type': component_type,
                'production_code': None,
                'uat_code': None,
                'has_changes': False,
                'changes_detected': False,
                'file_path': None,
                'production_exists': False,
                'uat_exists': False,
                'error': str(e)
            }
    
    def get_bundle_files(self, component_name: str, component_type: str, branch: str = "master") -> list:
        """
        Get all files in a component bundle
        
        Args:
            component_name: Component name
            component_type: Component type
            branch: Branch to check
        
        Returns:
            List of file paths in the bundle
        """
    
        # Determine folder path
        if component_type == 'lwc':
            folder_path = f"lwc/{component_name}"
        elif component_type in ['DataRaptor', 'IntegrationProcedure', 'OmniScript', 
                                'VlocityCard', 'CalculationProcedure']:
            folder_path = f"vlocity/{component_type}/{component_name}"
        elif component_type == 'aura':
            folder_path = f"aura/{component_name}"
        else:
            return []
        
        # Use BitBucket API to list files in folder
        url = f"{self.base_url}/src/{branch}/{folder_path}"
        
        try:
            response = requests.get(url, headers=self._get_headers())
            
            if response.status_code == 200:
                data = response.json()
                
                # Extract file paths from response
                files = []
                if 'values' in data:
                    for item in data['values']:
                        if item.get('type') == 'commit_file':
                            files.append(item.get('path'))
                
                return files
            else:
                print(f"Could not list files in {folder_path}: {response.status_code}")
                return []
                
        except Exception as e:
            print(f"Error listing bundle files: {str(e)}")
            return []
     
   
    def resolve_vlocity_bundle(self, branch: str, component_type: str, component_name: str):
        self.logger.info(
            "resolve_vlocity_bundle: branch=%s type=%s name=%s",
            branch, component_type, component_name
        )

        candidates = list(vlocity_bundle_folder_candidates(component_type, component_name))

        # ✅ FIXED: use self.logger and proper format placeholders
        for folder in candidates:
            self.logger.info("Trying folder candidate: %s", folder)
            items = self.list_folder(branch, folder)
            if items and isinstance(items, list):
                # NEW: preview JSON files inside the bundle folder
                files = [it for it in items if it.get("type") == "commit_file"]
                jsons = [it.get("path", "") for it in files if it.get("path", "").endswith(".json")]
                preview = ", ".join(p.rsplit("/", 1)[-1] for p in jsons[:5])
                self.logger.info(
                    "bundle listing ok at %s; json files (%d): %s%s",
                    folder, len(jsons),
                    preview if preview else "none",
                    " …" if len(jsons) > 5 else ""
                )
                return folder, items

        return None, None
            
    def list_folder(self, branch: str, folder: str, pagelen: int = 100):
        """
        List files in a repository folder for a given branch/ref.
        Returns a list of dicts (commit_file entries) or [] if empty, None on 404.
        """
        folder = folder.strip("/")
        url = f"{self.base_url}/src/{quote(branch, safe='')}/{quote(folder, safe='/')}/"
        params = {"pagelen": pagelen}
        cache_key = (branch, folder, pagelen)

        if cache_key in self._cache_list_folder:
            return self._cache_list_folder[cache_key]

        items = []
        try:
            while True:
                resp = self.session.get(url, headers=self._get_headers(), params=params, timeout=self.timeout)
                if resp.status_code == 404:
                    self._cache_list_folder[cache_key] = None
                    return None
                resp.raise_for_status()
                data = resp.json()

                values = data.get("values")
                if isinstance(values, list):
                    items.extend(values)

                next_url = data.get("next")
                if not next_url:
                    break
                url = next_url
                params = None  # next already has query
        except Exception as e:
            self.logger.error("list_folder failed: %s", e)
            self._cache_list_folder[cache_key] = None
            return None

        self._cache_list_folder[cache_key] = items
        return items

    def get_pull_request_commits(self, pr_id: int | str, pagelen: int = 50) -> list[dict]:
        """
        Bitbucket Cloud:
        GET https://api.bitbucket.org/2.0/repositories/{workspace}/{repo}/pullrequests/{id}/commits
        Returns a list of commit objects (at least 'hash' per item).
        """
        wid = getattr(self, "workspace", None)
        rid = getattr(self, "repo", None)
        base = getattr(self, "base_url", "https://api.bitbucket.org/2.0/repositories").rstrip("/")
        sess = getattr(self, "session", None)
        token = getattr(self, "token", None)

        if not (wid and rid and sess):
            raise RuntimeError("BitBucketClient missing workspace/repo/session")

        url = f"{base}/{wid}/{rid}/pullrequests/{pr_id}/commits"
        params = {"pagelen": pagelen}
        headers = {}
        # If your client already sets auth on the session, this header isn't needed.
        if token and "Authorization" not in getattr(sess, "headers", {}):
            headers["Authorization"] = f"Bearer {token}"

        commits: list[dict] = []
        while True:
            resp = sess.get(url, params=params, headers=headers, timeout=getattr(self, "timeout", 30))
            resp.raise_for_status()
            data = resp.json() or {}
            values = data.get("values", [])
            commits.extend(values)
            next_url = data.get("next")
            if not next_url:
                break
            # Bitbucket 'next' is a full URL; switch to it and clear params:
            url, params = next_url, {}
        log.info(f"[git_client] PR {pr_id} commits fetched: {len(commits)}")
        return commits
        
    def list_component_types(self, branch: str = "master") -> List[str]:
        """
        List available component types in vlocity folder
        
        Returns:
            List of component type names
        """
        url = f"{self.base_url}/src/{branch}/vlocity/"
        
        try:
            response = requests.get(url, headers=self._get_headers())
            
            if response.status_code == 200:
                data = response.json()
                items = data.get('values', [])
                
                # Filter for directories only
                return [
                    item['path'].split('/')[-1] 
                    for item in items 
                    if item['type'] == 'commit_directory'
                ]
            else:
                return []
                
        except Exception as e:
            print(f"Exception listing component types: {str(e)}")
            return []
    def get_file_commits(self, file_path: str, branch: str = "master", limit: int = 10) -> List[Dict]:
        """
        Get commit history for a specific file.
        """
        if not file_path:
            return []

        cache_key = (branch, file_path, int(limit))
        if cache_key in self._cache_get_file_commits:
            return self._cache_get_file_commits[cache_key]

        url = f"{self.base_url}/commits/{quote(branch, safe='')}"
        params = {'path': file_path, 'pagelen': int(limit)}

        try:
            response = self.session.get(url, headers=self._get_headers(), params=params, timeout=self.timeout)
            if response.status_code == 200:
                data = response.json()
                commits = data.get('values', []) or []
                result = [{
                    'hash': c.get('hash'),
                    'short_hash': (c.get('hash') or '')[:8],
                    'message': c.get('message'),
                    'author': (c.get('author') or {}).get('raw'),
                    'date': c.get('date')
                } for c in commits]
                self._cache_get_file_commits[cache_key] = result
                return result
            else:
                self.logger.warning("get_file_commits %s %s -> %s", branch, file_path, response.status_code)
                self._cache_get_file_commits[cache_key] = []
                return []
        except Exception as e:
            self.logger.error("get_file_commits error: %s", e)
            self._cache_get_file_commits[cache_key] = []
            return []
        
    def get_pull_request_diffstat(self, pr_id: int | str, pagelen: int = 50) -> list[dict]:
        """
        Bitbucket Cloud:
        GET .../pullrequests/{id}/diffstat
        Returns a list of file change entries. Normalized later by our adapter.
        """
        wid = getattr(self, "workspace", None)
        rid = getattr(self, "repo", None)
        base = getattr(self, "base_url", "https://api.bitbucket.org/2.0/repositories").rstrip("/")
        sess = getattr(self, "session", None)
        token = getattr(self, "token", None)

        if not (wid and rid and sess):
            raise RuntimeError("BitBucketClient missing workspace/repo/session")

        url = f"{base}/{wid}/{rid}/pullrequests/{pr_id}/diffstat"
        params = {"pagelen": pagelen}
        headers = {}
        if token and "Authorization" not in getattr(sess, "headers", {}):
            headers["Authorization"] = f"Bearer {token}"

        out: list[dict] = []
        while True:
            resp = sess.get(url, params=params, headers=headers, timeout=getattr(self, "timeout", 30))
            resp.raise_for_status()
            data = resp.json() or {}
            values = data.get("values", [])
            out.extend(values)
            next_url = data.get("next")
            if not next_url:
                break
            url, params = next_url, {}

        return out
    
    # Add to git_client.py

    def get_commit_details(self, commit_sha: str) -> Dict:
        """Get comprehensive commit information including timestamp"""
        try:
            url = f"https://api.bitbucket.org/2.0/repositories/{self.workspace}/{self.repo}/commit/{commit_sha}"
            response = self.session.get(url)
            
            if response.status_code == 200:
                data = response.json()
                return {
                    'success': True,
                    'commit_hash': commit_sha,
                    'author': data.get('author', {}).get('raw', 'Unknown'),
                    'date': data.get('date', ''),
                    'message': data.get('message', ''),
                    'parents': [p.get('hash') for p in data.get('parents', [])]
                }
            else:
                return {'success': False, 'error': f"API Error: {response.status_code}"}
                
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def get_commit_timestamp(self, commit_sha: str) -> Optional[str]:
        """Get just the commit timestamp for verification"""
        details = self.get_commit_details(commit_sha)
        return details.get('date') if details.get('success') else None



# Test function
if __name__ == "__main__":
    print("=" * 70)
    print("🧪 Testing BitBucket Client")
    print("=" * 70)
    print()
    
    client = BitBucketClient()
    
    # Test 1: List component types
    print("Test 1: Listing component types...")
    types = client.list_component_types()
    print(f"✅ Found {len(types)} types: {', '.join(types[:5])}")
    print()
    
    # Test 2: Get a file
    print("Test 2: Fetching a component...")
    path = client.build_component_path("PRGetInstallmentTermUpdate", "DataRaptor")
    print(f"   Path: {path}")
    
    content = client.get_file_content(path)
    if content:
        print(f"✅ File retrieved: {len(content)} characters")
    else:
        print("⚠️  File not found (might need different path)")
    print()
    
    # Test 3: Get diff
    print("Test 3: Getting component diff...")
    diff = client.get_component_diff("PRGetInstallmentTermUpdate", "DataRaptor")
    print(f"   Production exists: {diff['production_exists']}")
    print(f"   UAT exists: {diff['uat_exists']}")
    print(f"   Has changes: {diff['has_changes']}")
    print()
    
    print("=" * 70)
    print("✅ Client is working!")
    print("=" * 70)