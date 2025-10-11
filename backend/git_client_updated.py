
"""
BitBucket Git Client
Fetches code from repository for diff comparison and story validation.
"""
import os
import requests
from typing import Optional, Dict, List
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class BitBucketClient:
    """Client for interacting with BitBucket API v2"""

    def __init__(self):
        self.token = os.getenv('BITBUCKET_TOKEN')
        self.workspace = os.getenv('BITBUCKET_WORKSPACE', 'lla-dev')
        self.repo = os.getenv('BITBUCKET_REPO', 'copado_lla')
        self.base_url = f"https://api.bitbucket.org/2.0/repositories/{self.workspace}/{self.repo}"

        if not self.token:
            raise ValueError("BITBUCKET_TOKEN not set in .env file")

    def _get_headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.token}",
            "Accept": "application/json"
        }

    def get_file_content(self, file_path: str, branch: str = "master") -> Optional[str]:
        url = f"{self.base_url}/src/{branch}/{file_path}"
        try:
            response = requests.get(url, headers=self._get_headers())
            if response.status_code == 200:
                return response.text
            return None
        except Exception as e:
            print("❌ Error fetching file content:", e)
            return None

    def get_commits_for_story(self, story_id: str, branch: str = "master", max_pages: int = 5) -> List[Dict]:
        url = f"{self.base_url}/commits/{branch}"
        commits = []
        for _ in range(max_pages):
            response = requests.get(url, headers=self._get_headers())
            if response.status_code != 200:
                print("❌ Failed to fetch commits:", response.status_code)
                break
            data = response.json()
            for commit in data.get("values", []):
                msg = commit.get("message", "")
                if story_id.lower() in msg.lower():
                    commits.append(commit)
            url = data.get("next")
            if not url:
                break
        return commits

    def get_files_changed_in_commit(self, commit_hash: str) -> List[str]:
        url = f"{self.base_url}/diffstat/{commit_hash}"
        response = requests.get(url, headers=self._get_headers())

        if response.status_code != 200:
            print("❌ Error fetching diffstat:", response.status_code)
            return []

        try:
            data = response.json()
        except Exception as e:
            print("❌ Failed to parse JSON:", e)
            return []

        return [entry.get("new", {}).get("path", "") for entry in data.get("values", []) if "new" in entry]

    def get_commit_history(self, file_path: str, max_pages: int = 5) -> List[Dict]:
        url = f"{self.base_url}/commits?path={file_path}"
        history = []
        for _ in range(max_pages):
            response = requests.get(url, headers=self._get_headers())
            if response.status_code != 200:
                print("❌ Failed to fetch file history:", response.status_code)
                break
            data = response.json()
            history.extend(data.get("values", []))
            url = data.get("next")
            if not url:
                break
        return history

