# config.py
import os

# Public mapping from human environment names (CSV/UI) to internal org IDs
ENV_ALIAS = {
    "Production": "master",
    "Preprod": "prep",
    "PreProd": "prep",  # optional alias tolerance
    "UAT": "uatsfdc",
}

# Internal mapping from org ID to connection config.
# Keep secrets in environment variables.
ORG_CONFIG = {
    "master": {
        "sf_login_url": os.environ.get("SF_MASTER_LOGIN_URL", "https://login.salesforce.com"),
        "sf_username":  os.environ.get("SF_MASTER_USERNAME", ""),
        "sf_auth_type": os.environ.get("SF_MASTER_AUTH_TYPE", "jwt"),
        "sf_client_id": os.environ.get("SF_MASTER_CLIENT_ID", ""),
        "sf_jwt_key":   os.environ.get("SF_MASTER_JWT_KEY_PATH", ""),  # path to private key if using JWT
    },
    "prep": {
        "sf_login_url": os.environ.get("SF_PREP_LOGIN_URL", "https://test.salesforce.com"),
        "sf_username":  os.environ.get("SF_PREP_USERNAME", ""),
        "sf_auth_type": os.environ.get("SF_PREP_AUTH_TYPE", "jwt"),
        "sf_client_id": os.environ.get("SF_PREP_CLIENT_ID", ""),
        "sf_jwt_key":   os.environ.get("SF_PREP_JWT_KEY_PATH", ""),
    },
    "uatsfdc": {
        "sf_login_url": os.environ.get("SF_UAT_LOGIN_URL", "https://test.salesforce.com"),
        "sf_username":  os.environ.get("SF_UAT_USERNAME", ""),
        "sf_auth_type": os.environ.get("SF_UAT_AUTH_TYPE", "jwt"),
        "sf_client_id": os.environ.get("SF_UAT_CLIENT_ID", ""),
        "sf_jwt_key":   os.environ.get("SF_UAT_JWT_KEY_PATH", ""),
    },
}

def resolve_org(org_id: str) -> dict:
    """
    Return the connection config for a given orgId or raise ValueError with the allowed list.
    """
    cfg = ORG_CONFIG.get(org_id)
    if not cfg:
        allowed = ", ".join(sorted(ORG_CONFIG.keys()))
        raise ValueError(f"Unknown orgId '{org_id}'. Allowed: {allowed}")
    return cfg

def map_environment_to_org_id(env_label: str) -> str:
    """
    Map a human-friendly environment name (e.g. from CSV) to our internal orgId.
    """
    if not env_label:
        raise ValueError("Empty environment label")
    org_id = ENV_ALIAS.get(env_label.strip())
    if not org_id:
        allowed = ", ".join(sorted(ENV_ALIAS.keys()))
        raise ValueError(f"Unknown environment '{env_label}'. Allowed environment labels: {allowed}")
    return org_id
