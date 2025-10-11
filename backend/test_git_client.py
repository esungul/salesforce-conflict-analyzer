import requests
from git_client_updated import BitBucketClient

client = BitBucketClient()

# Use the known commit ID
commit_id = "29baa98"

# 1. Get commit details
url = f"{client.base_url}/commit/{commit_id}"
resp = client._get_headers()
response = requests.get(url, headers=resp)

print(f"\n🔍 Commit ID: {commit_id}")
if response.status_code != 200:
    print("❌ Failed to fetch commit.")
    print(response.text)
else:
    commit_data = response.json()
    print("✅ Commit Message:", commit_data.get("message", "No message found"))
    print("📅 Date:", commit_data.get("date"))
    print("👤 Author:", commit_data.get("author", {}).get("raw"))

# 2. Get changed files
print("\n📁 Files changed in commit:")
files = client.get_files_changed_in_commit(commit_id)
if not files:
    print("❌ No files found or failed to parse diff.")
else:
    for f in files:
        print("  -", f)
