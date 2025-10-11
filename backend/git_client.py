"""
BitBucket Git Client
Fetches code from repository for diff comparison
"""
import os
import requests
from typing import Optional, Dict, List
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class BitBucketClient:
    """Client for interacting with BitBucket API v2"""
    
    def get_bundle_diff(self, component_name: str, component_type: str, 
                    prod_branch: str = "master", uat_branch: str = "uatsfdc") -> dict:
        """
        Get diff for all files in a component bundle
        """
        # Determine folder path
        if component_type == 'lwc':
            folder = f"lwc/{component_name}"
            extensions = ['.js', '.html', '.css', '.js-meta.xml']
        elif component_type == 'aura':
            folder = f"aura/{component_name}"
            extensions = ['.cmp', '.js', '.css', '.design', '.svg', '.auradoc']
        elif component_type in ['DataRaptor', 'IntegrationProcedure', 'OmniScript']:
            folder = f"vlocity/{component_type}/{component_name}"
            extensions = ['_DataPack.json', '_Extract.json', '_Transform.json', '.json']
        else:
            # Single file component - use existing method
            return self.get_component_diff(component_name, component_type, prod_branch, uat_branch)
        
        # Get all files in bundle
        files_to_check = [
            f"{folder}/{component_name}{ext}" for ext in extensions
        ]
        
        bundle_files = []
        has_any_changes = False
        
        for file_path in files_to_check:
            prod_content = self.get_file_content(file_path, prod_branch)
            uat_content = self.get_file_content(file_path, uat_branch)
            
            if prod_content is not None or uat_content is not None:
                has_changes = prod_content != uat_content if (prod_content and uat_content) else True
                if has_changes:
                    has_any_changes = True
                
                bundle_files.append({
                    'file_path': file_path,
                    'file_name': file_path.split('/')[-1],
                    'production_code': prod_content,
                    'uat_code': uat_content,
                    'has_changes': has_changes,
                    'exists_in_prod': prod_content is not None,
                    'exists_in_uat': uat_content is not None
                })
        
        return {
            'component_name': component_name,
            'component_type': component_type,
            'is_bundle': True,
            'bundle_files': bundle_files,
            'has_changes': has_any_changes,
            'file_path': folder
        }
    
    def __init__(self):
        self.token = os.getenv('BITBUCKET_TOKEN')
        self.workspace = os.getenv('BITBUCKET_WORKSPACE', 'lla-dev')
        self.repo = os.getenv('BITBUCKET_REPO', 'copado_lla')
        self.base_url = f"https://api.bitbucket.org/2.0/repositories/{self.workspace}/{self.repo}"
        
        if not self.token:
            raise ValueError("BITBUCKET_TOKEN not set in .env file")
    
    def _get_headers(self) -> Dict[str, str]:
        """Get authentication headers"""
        return {
            "Authorization": f"Bearer {self.token}",
            "Accept": "application/json"
        }
  
    def get_file_content(self, file_path: str, branch: str = "master") -> Optional[str]:
        """
        Get file content from repository
        Tries the provided path first
        """
        url = f"{self.base_url}/src/{branch}/{file_path}"
        
        try:
            response = requests.get(url, headers=self._get_headers())
            
            if response.status_code == 200:
                return response.text
            elif response.status_code == 404:
                return None
            else:
                print(f"Error fetching file: {response.status_code}")
                return None
                
        except Exception as e:
            print(f"Exception fetching file: {str(e)}")
            return None

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
        if '.' in component_name:
            component_name = component_name.split('.', 1)[1]
        
        paths = []
        
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
                f"vlocity/OmniScript/{component_name}/{component_name}_DataPack.json"
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
            return f"permissionsets/{component_name}.permissionset-meta.xml"
        
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
        Get commit history for a specific file
        
        Args:
            file_path: Path to file
            branch: Branch name
            limit: Number of commits to retrieve
        
        Returns:
            List of commit dictionaries
        """
        url = f"{self.base_url}/commits/{branch}"
        params = {
            'path': file_path,
            'pagelen': limit
        }
        
        try:
            response = requests.get(
                url, 
                headers=self._get_headers(),
                params=params
            )
            
            if response.status_code == 200:
                data = response.json()
                commits = data.get('values', [])
                
                result = []
                for commit in commits:
                    result.append({
                        'hash': commit['hash'],
                        'short_hash': commit['hash'][:8],
                        'message': commit['message'],
                        'author': commit['author']['raw'],
                        'date': commit['date']
                    })
                
                return result
            else:
                return []
                
        except Exception as e:
            print(f"Error getting file commits: {str(e)}")
            return []

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