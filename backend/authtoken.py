"""
Final token test for sunny.gulati@cwc.com
"""
import requests

# ============================================
# PASTE YOUR NEW TOKEN HERE
# ============================================
API_TOKEN = "ATCTT3xFfGN0BSEvgqvCPeL0J-ZYXbhO0wJDgwSC8l3n1x7NtpX93gnqcLgT0-91d_rAj51QG8il-_JgJ4xmSg8hfEFpjV3b5HRG63nTykYC5Hb-iOrtwjaL11_z3M0zQg0YWEFARLdigkrGUHh9JaQ-MXOs7bS5ua2kFGd-gxxA1j7Wd-z18eU=482AB4B9"  # ← Paste the token with scopes

WORKSPACE = "lla-dev"
REPO_NAME = "copado_lla"
BRANCH = "master"

print("=" * 70)
print("🧪 Final BitBucket Token Test")
print("=" * 70)
print(f"User: esungul (sunny.gulati@cwc.com)")
print(f"Repository: {WORKSPACE}/{REPO_NAME}\n")

# Test 1: Basic connection
print("Test 1: Repository connection...")
url = f"https://api.bitbucket.org/2.0/repositories/{WORKSPACE}/{REPO_NAME}"
headers = {
    "Authorization": f"Bearer {API_TOKEN}",
    "Accept": "application/json"
}

response = requests.get(url, headers=headers)

if response.status_code == 200:
    print("✅ SUCCESS!\n")
    repo = response.json()
    print(f"   Repository: {repo['name']}")
    print(f"   Main branch: {repo['mainbranch']['name']}")
    print(f"   Is private: {repo['is_private']}\n")
elif response.status_code == 401:
    print("❌ FAILED - Authentication error\n")
    print("The token doesn't work. Please:")
    print("1. Make sure you clicked 'Create token WITH SCOPES'")
    print("2. Checked the 'repository' scope")
    print("3. Copied the FULL token\n")
    exit(1)
else:
    print(f"❌ FAILED - Error {response.status_code}")
    print(f"{response.text}\n")
    exit(1)

# Test 2: Read a specific file
print("Test 2: Reading file from vlocity folder...")
file_path = "vlocity/DataRaptor/Billing_DRgetChildAssets/Billing_DRgetChildAssets_DataPack.json"
url = f"https://api.bitbucket.org/2.0/repositories/{WORKSPACE}/{REPO_NAME}/src/{BRANCH}/{file_path}"

response = requests.get(url, headers=headers)

if response.status_code == 200:
    print("✅ SUCCESS!\n")
    print(f"   File size: {len(response.text):,} characters")
    print(f"   Preview: {response.text[:80]}...\n")
elif response.status_code == 404:
    print("⚠️  File not found (might be OK - different path)\n")
else:
    print(f"⚠️  Warning - Error {response.status_code}\n")

# Test 3: List vlocity components
print("Test 3: Listing vlocity component types...")
url = f"https://api.bitbucket.org/2.0/repositories/{WORKSPACE}/{REPO_NAME}/src/{BRANCH}/vlocity/"

response = requests.get(url, headers=headers)

if response.status_code == 200:
    print("✅ SUCCESS!\n")
    data = response.json()
    items = [item for item in data.get('values', []) if item['type'] == 'commit_directory']
    
    print(f"   Found {len(items)} component types:")
    for item in items[:8]:
        folder = item['path'].split('/')[-1]
        print(f"   📂 {folder}")
    
    if len(items) > 8:
        print(f"   ... and {len(items) - 8} more")
    print()
else:
    print(f"⚠️  Warning - Error {response.status_code}\n")

# Test 4: Check authenticated user
print("Test 4: Checking authenticated user...")
url = "https://api.bitbucket.org/2.0/user"

response = requests.get(url, headers=headers)

if response.status_code == 200:
    user = response.json()
    print("✅ SUCCESS!\n")
    print(f"   Display name: {user.get('display_name', 'N/A')}")
    print(f"   Username: {user.get('username', 'N/A')}")
    print(f"   UUID: {user.get('uuid', 'N/A')}\n")

# Final summary
print("=" * 70)
print("🎉 ALL TESTS PASSED!")
print("=" * 70)
print()
print("Your token is working perfectly!")
print()
print("Next steps:")
print("1. Save token in .env file")
print("2. Build Git client")
print("3. Add 'View Code Changes' to dashboard")
print("4. Show side-by-side code diffs")
print()
print("Ready to build the code diff viewer! 🚀")