"""
Test Script: Commit Analysis for Conflict Detection
Run this to see if we can analyze commits properly
"""

import os
import requests
from git_client import BitBucketClient

# Temporary method added to test script only
def add_temp_methods():
    """Add temporary methods to BitBucketClient for testing"""
    
    def get_file_content_at_commit(self, file_path: str, commit_hash: str):
        """
        Get file content at specific commit
        """
        url = f"{self.base_url}/src/{commit_hash}/{file_path}"
        
        try:
            response = requests.get(url, headers=self._get_headers())
            if response.status_code == 200:
                return response.text
            elif response.status_code == 404:
                return None
            else:
                print(f"Error fetching file at commit {commit_hash}: {response.status_code}")
                return None
        except Exception as e:
            print(f"Exception fetching file at commit: {str(e)}")
            return None

    def get_commit_diff(self, commit_spec: str):
        """
        Get raw diff between commits (commit1..commit2)
        """
        url = f"{self.base_url}/diff/{commit_spec}"
        
        try:
            response = requests.get(url, headers=self._get_headers())
            if response.status_code == 200:
                return response.text
            else:
                print(f"Error fetching diff: {response.status_code}")
                return None
        except Exception as e:
            print(f"Exception fetching diff: {str(e)}")
            return None

    # Add methods to BitBucketClient temporarily
    BitBucketClient.get_file_content_at_commit = get_file_content_at_commit
    BitBucketClient.get_commit_diff = get_commit_diff
    print("✅ Temporary methods added to BitBucketClient")

def test_commit_analysis():
    print("🚀 Testing Commit Analysis")
    print("=" * 50)
    
    # Add temporary methods first
    add_temp_methods()
    
    client = BitBucketClient()
    
    # Your actual data
    component_name = "prDeviceTile"
    component_type = "LightningComponentBundle"
    
    commits = [
        {"hash": "a13c16d", "story": "US-0033319", "type": "story"},
        {"hash": "a669d21", "story": "US-0033389", "type": "story"}, 
        {"hash": "4bf7441", "story": "MERGE", "type": "merge"},
        {"hash": "910e4e2", "story": "US-0033638", "type": "story"}
    ]
    
    print(f"📦 Component: {component_name} ({component_type})")
    print(f"📝 Commits: {len(commits)} commits")
    for commit in commits:
        print(f"   - {commit['hash']}: {commit['story']}")
    
    print("\n" + "=" * 50)
    print("1. Testing Component Diff with Commits")
    print("=" * 50)
    
    # Test 1: Try using commit hashes with existing method
    oldest = "a13c16d"
    newest = "910e4e2"
    
    print(f"Testing: {oldest}..{newest}")
    
    try:
        result = client.get_component_diff(
            component_name,
            component_type,
            oldest,    # Try commit hash instead of 'master'
            newest     # Try commit hash instead of 'uatsfdc'  
        )
        
        print("✅ get_component_diff executed successfully")
        print(f"   Has changes: {result.get('has_changes', 'N/A')}")
        print(f"   Production exists: {result.get('production_exists', 'N/A')}")
        print(f"   UAT exists: {result.get('uat_exists', 'N/A')}")
        print(f"   Error: {result.get('error', 'None')}")
        
    except Exception as e:
        print(f"❌ get_component_diff failed: {e}")
        result = None
    
    print("\n" + "=" * 50)
    print("2. Testing File Path Detection")
    print("=" * 50)
    
    # Test 2: Find the actual file path
    try:
        content, file_path = client.get_file_content_smart(component_name, component_type, "master")
        print(f"File path: {file_path}")
        print(f"Content found: {content is not None}")
        
        if file_path:
            print(f"\n3. Testing File Content at Specific Commits")
            print("=" * 50)
            
            # Test all commits
            for commit in commits:
                try:
                    commit_content = client.get_file_content_at_commit(file_path, commit["hash"])
                    status = "✅ FOUND" if commit_content is not None else "❌ NOT FOUND"
                    print(f"   {commit['hash']}: {status}")
                    if commit_content:
                        print(f"      Content length: {len(commit_content)} chars")
                except Exception as e:
                    print(f"   {commit['hash']}: ❌ Failed - {e}")
                    
            print(f"\n4. Testing Raw Commit Diff")
            print("=" * 50)
            
            # Test raw diff between commits
            commit_spec = f"{oldest}..{newest}"
            raw_diff = client.get_commit_diff(commit_spec)
            print(f"   Raw diff length: {len(raw_diff) if raw_diff else 'FAILED'} chars")
            
        else:
            print("❌ Could not find file path")
            
    except Exception as e:
        print(f"❌ File path detection failed: {e}")
    
    print("\n" + "=" * 50)
    print("5. Testing Complete Analysis")
    print("=" * 50)
    
    # Test the complete analysis approach
    try:
        analysis_result = analyze_conflict_commits(client, component_name, component_type, commits)
        print("✅ Complete analysis executed")
        for key, value in analysis_result.items():
            print(f"   {key}: {value}")
    except Exception as e:
        print(f"❌ Complete analysis failed: {e}")
    
    print("\n" + "=" * 50)
    print("📊 TEST SUMMARY")
    print("=" * 50)
    
    summary = {
        "commit_diff_works": result and 'has_changes' in result,
        "file_path_found": 'file_path' in locals() and file_path is not None,
        "file_at_commit_works": False,  # We'll update this
        "raw_diff_works": 'raw_diff' in locals() and raw_diff is not None
    }
    
    for test, passed in summary.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status}: {test}")
    
    return summary

def analyze_conflict_commits(client, component_name, component_type, commits):
    """
    Complete analysis using single API call approach
    """
    if len(commits) < 2:
        return {"error": "Need at least 2 commits"}
    
    oldest = commits[0]["hash"]
    newest = commits[-1]["hash"]
    
    # Single API call for complete analysis
    full_diff = client.get_component_diff(component_name, component_type, oldest, newest)
    
    # Simple analysis
    if full_diff["has_changes"]:
        analysis = f"Latest story ({commits[-1]['story']}) includes changes from {len(commits)-1} previous commits"
    else:
        analysis = "No changes detected in commit range"
    
    return {
        "component": component_name,
        "commit_range": f"{oldest}..{newest}",
        "stories_involved": [c["story"] for c in commits],
        "has_changes": full_diff["has_changes"],
        "analysis": analysis,
        "recommendation": "All changes are included in latest story" if full_diff["has_changes"] else "No deployment coordination needed"
    }

if __name__ == "__main__":
    print("Starting Commit Analysis Test...")
    test_commit_analysis()