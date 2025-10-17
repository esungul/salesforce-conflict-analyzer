This document explains how to configure and tune the backend services for optimal performance.
All settings are centralized in config.py, so you can control everything via environment variables or .env files — no code changes required.

🧩 1. Configuration Sources

The backend loads configuration values in this priority order:

Environment variables (export API_MAX_WORKERS=8, etc.)

config.py defaults

(Optionally) a .env file (if your runtime supports python-dotenv or similar)

All settings are read once at startup by:

from config import get_config
cfg = get_config()


Then shared across:

git_client.py → for Bitbucket connection, pooling, retries

app.py → for API thread pools and wrappers

⚙️ 2. Environment Variables & Defaults
Variable	Description	Default	Used In
API_MAX_WORKERS	Max threads used in Flask APIs (e.g., /api/production-state)	8	app.py
BITBUCKET_MAX_WORKERS	Threads used for parallel Bitbucket operations (e.g., file diffs)	8	git_client.py
BITBUCKET_POOL_MAXSIZE	Max concurrent HTTP connections to Bitbucket	32	git_client.py
BITBUCKET_TIMEOUT	Timeout (in seconds) for Bitbucket requests	2.0	git_client.py
BITBUCKET_BASE_URL	Override Bitbucket API root (on-prem/self-hosted support)	https://api.bitbucket.org/2.0	git_client.py
BITBUCKET_TOKEN	Auth token for Bitbucket REST API	(required for private repos)	git_client.py
BITBUCKET_WORKSPACE	Default Bitbucket workspace/org name	(required)	git_client.py
BITBUCKET_REPO	Default repository slug	(required)	git_client.py
SELF_BASE_URL	Base URL for local internal API calls (used by wrappers)	http://127.0.0.1:5000	app.py
COMPONENT_TYPES_YAML	(Optional) Custom path to component_types.yaml	component_types.yaml	component_registry.py
🧪 3. Quick Setup Examples
✅ Example 1 — Local Development
# .env or shell exports
export API_MAX_WORKERS=8
export BITBUCKET_MAX_WORKERS=8
export BITBUCKET_POOL_MAXSIZE=32
export BITBUCKET_TIMEOUT=2
export BITBUCKET_TOKEN=your_bitbucket_token
export BITBUCKET_WORKSPACE=lla-dev
export BITBUCKET_REPO=copado_lla
export SELF_BASE_URL=http://127.0.0.1:5000


Then:

python app.py

✅ Example 2 — Production Docker

In your Dockerfile or docker-compose.yml:

environment:
  API_MAX_WORKERS: 16
  BITBUCKET_MAX_WORKERS: 10
  BITBUCKET_POOL_MAXSIZE: 40
  BITBUCKET_TIMEOUT: 3
  BITBUCKET_TOKEN: ${BITBUCKET_TOKEN}
  BITBUCKET_WORKSPACE: "lla-prod"
  BITBUCKET_REPO: "copado_lla"

🧵 4. How These Settings Work Together
Layer	Uses	Controlled By
Flask APIs	Thread pools for component iteration (/api/production-state)	API_MAX_WORKERS
Bitbucket Client	Thread pools for parallel file/diff operations	BITBUCKET_MAX_WORKERS
HTTP Pooling	Reuse of open connections to Bitbucket (keep-alive)	BITBUCKET_POOL_MAXSIZE
Timeouts	Request-level timeout for slow Bitbucket calls	BITBUCKET_TIMEOUT

These values can be tuned independently depending on network latency, Bitbucket server responsiveness, and expected payload size.

🚀 5. Tuning Recommendations
Scenario	Suggested Settings	Notes
Local dev / small repo	API_MAX_WORKERS=4 BITBUCKET_MAX_WORKERS=4	Keeps CPU usage low
QA / medium repo (default)	API_MAX_WORKERS=8 BITBUCKET_MAX_WORKERS=8	Balanced performance
Large repo / CI job	API_MAX_WORKERS=16 BITBUCKET_MAX_WORKERS=12	Requires higher CPU; verify Bitbucket rate limits
Unstable Bitbucket network	BITBUCKET_TIMEOUT=5 BITBUCKET_POOL_MAXSIZE=16	Increase timeout; reduce pool size if connection resets occur
On-prem Bitbucket	Set BITBUCKET_BASE_URL=https://bitbucket.mycorp.local/rest/api/1.0	Adjust API path as needed
🧰 6. Accessing Config in Code

Anywhere in your backend you can do:

from config import get_config

cfg = get_config()
print(cfg.API_MAX_WORKERS)
print(cfg.BITBUCKET_TIMEOUT)


The returned Config object is a frozen dataclass (immutable singleton), so it’s safe to import anywhere without performance cost.

🧱 7. Validation & Troubleshooting
Verify Current Configuration

You can add a helper route for debugging (optional):

@app.route("/api/config", methods=["GET"])
def get_runtime_config():
    from config import get_config
    cfg = get_config()
    return jsonify({
        "API_MAX_WORKERS": cfg.API_MAX_WORKERS,
        "BITBUCKET_MAX_WORKERS": cfg.BITBUCKET_MAX_WORKERS,
        "BITBUCKET_POOL_MAXSIZE": cfg.BITBUCKET_POOL_MAXSIZE,
        "BITBUCKET_TIMEOUT": cfg.BITBUCKET_TIMEOUT,
        "SELF_BASE_URL": cfg.SELF_BASE_URL,
        "workspace": cfg.BITBUCKET_WORKSPACE,
        "repo": cfg.BITBUCKET_REPO_SLUG,
        "base_url": cfg.BITBUCKET_BASE_URL or "https://api.bitbucket.org/2.0"
    })


Call:

curl http://localhost:5000/api/config | jq .

Common Issues
Symptom	Likely Cause	Fix
401 Unauthorized	Missing or invalid BITBUCKET_TOKEN	Re-export valid token
Slow API responses	Low worker count or no connection pooling	Increase API_MAX_WORKERS and BITBUCKET_POOL_MAXSIZE
Rate limiting / 429	Too many parallel Bitbucket calls	Reduce BITBUCKET_MAX_WORKERS, add retry delay
workspace/repo not configured error	Missing env vars	Set BITBUCKET_WORKSPACE and BITBUCKET_REPO
🧠 8. Key Takeaways

All runtime behavior (timeouts, concurrency, Bitbucket details) is driven by config.py.

Adjust once, and all APIs inherit the new settings.

Caching + session pooling + thread pools provide 2–4× faster responses.

Same environment variables can be used locally, in CI, or production containers.

Example sanity check
echo "API_MAX_WORKERS=$API_MAX_WORKERS"
echo "BITBUCKET_TIMEOUT=$BITBUCKET_TIMEOUT"
python -c "from config import get_config; print(get_config())"


Output:

Config(API_MAX_WORKERS=8, BITBUCKET_MAX_WORKERS=8, BITBUCKET_POOL_MAXSIZE=32, BITBUCKET_TIMEOUT=2.0, SELF_BASE_URL='http://127.0.0.1:5000', ...)


✅ Result:
A single, consistent configuration system that controls performance, networking, and connection behavior for the entire backend.