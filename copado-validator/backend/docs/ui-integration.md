Salesforce Conflict Analyzer – UI Integration Guide

Base URL: http://<backend-host>:5000
Auth: none (network-restricted; add auth if exposing outside your VPN)
Content Type: application/json
Version: v1 (current)

Endpoints
1) POST /api/analyze-sf

Analyze conflicts for a Copado Release or a set of User Stories. Returns component-level conflicts, story-to-story overlaps, and rich per-story details (developer, Jira, commit links, etc.).

Request body

Provide exactly one of releaseNames or userStoryNames.

{
  "releaseNames": "SFDC-PEAC-B2C 25.21.1",
  "configJsonPath": "/path/to/sf_creds.json"
}

{
  "userStoryNames": "US-0033466,US-0033526,US-0033692",
  "configJsonPath": "/path/to/sf_creds.json"
}


releaseNames: string or string[] — Copado Release Name(s).

userStoryNames: string or string[] — Copado US IDs.

configJsonPath (optional if env-based auth) — path to JSON with SF_USERNAME, SF_PASSWORD, SF_SECURITY_TOKEN, SF_DOMAIN (optional).

The API accepts comma-separated strings or arrays. It validates input and returns 400 if neither is provided.

Successful response (200)
{
  "summary": {
    "stories": 3,
    "components": 52,
    "component_conflicts": 1,
    "story_conflicts": 3,
    "detail": {
      "total_conflicts": 1,
      "severity_breakdown": { "low": 0, "medium": 1, "high": 0, "critical": 0, "blocker": 0 },
      "affected_stories": 3,
      "avg_risk_score": 20.0
    }
  },
  "component_conflicts": [
    {
      "component": {
        "api_name": "OmniScript.PR_MobilePrepaidChangePlan_English",
        "type": "OMNI_SCRIPT",
        "status": "AUTO_RESOLVED",
        "last_commit_date": "2025-10-09T13:20:09",
        "created_by": "Shivani Soni",
        "unique_id": "aC2P..._OmniScript.PR_MobilePrepaidChangePlan_English",
        "user_story_id": "US-0033692"
      },

      "severity": "MEDIUM",
      "risk_score": 20,
      "risk_factors": ["3 stories modifying same component"],

      "latest_owner": "US-0033692",
      "deploy_order_hint": ["US-0033466","US-0033526","US-0033692"],
      "recommendation": {
        "action": "DEPLOY LATEST STORY LAST",
        "priority": "LOW",
        "steps": [
          "Deploy US-0033466, then US-0033526",
          "Deploy US-0033692 last",
          "Smoke-test the component after final deploy"
        ]
      },

      "involved_stories": [
        {
          "name": "US-0033466",
          "title": "Development / SIT Deployment / QA Deployment - SAL-83930",
          "environment": "production",
          "developer": "Shivani Soni",              // may be filled from CreatedBy/LastModifiedBy if primary developer is missing
          "jira_key": "SAL-83930",                  // when available on the US
          "story_points": null,
          "close_date": null,

          "component_action": "AUTO_RESOLVED",      // per-story component info
          "component_status": "AUTO_RESOLVED",
          "component_category": "—",
          "module_directory": "force-app/...",

          "last_commit_date": "2025-09-26T10:30:10",
          "created_by": "Shivani Soni",
          "last_modified_by": "Shivani Soni",
          "created_date": "2025-09-26T10:30:10",
          "last_modified_date": "2025-09-26T10:30:10",

          "commit_url": "https://bitbucket.org/.../commits/df08c199d5...",
          "commit_sha": "df08c199d53e558dad2e238d2fe8ff8fe5b7ea5f"
        },
        { "...": "..." }
      ],

      "stories_with_commit_info": [
        {
          "commit_date": "2025-10-09T13:20:09",
          "created_by": "Shivani Soni",
          "story": {
            "id": "US-0033692",
            "title": "Deployment for PR_DRGetAssetNameFromId for productchild - SAL-84464",
            "developer": "—",
            "environment": "production",
            "project": "LLA",
            "jira_key": "SAL-84464",
            "components": [
              {
                "api_name": "OmniScript.PR_MobilePrepaidChangePlan_English",
                "type": "OMNI_SCRIPT",
                "status": "AUTO_RESOLVED",
                "last_commit_date": "2025-10-09T13:20:09",
                "created_by": "Shivani Soni",
                "user_story_id": "US-0033692"
              }
            ]
          }
        }
      ]
    }
  ],

  "story_conflicts": [
    {
      "story1_id": "US-0033466",
      "story1_developer": "Shivani Soni",
      "story2_id": "US-0033526",
      "story2_developer": "ankush guleria",
      "shared_components": ["OmniScript.PR_MobilePrepaidChangePlan_English"],
      "shared_count": 1,
      "needs_coordination": true
    }
  ],

  "debug_csv_path": "/backend/tmp/online_inputs/stories_xxx.csv"
}


Notes:

developer is populated from primary US developer when available; otherwise falls back to CreatedBy.Name → LastModifiedBy.Name → commit info’s created_by.

jira_key is read from copado__User_Story__r.copadoccmint__JIRA_key__c (plus common fallbacks); appears in involved_stories[].jira_key and stories_with_commit_info[].story.jira_key when available.

deploy_order_hint is sorted oldest → latest; deploy the latest last.

Errors

400 — validation (missing both releaseNames and userStoryNames, wrong types).

401 — Salesforce login/query failure (bad creds or SOQL error).

200 with empty lists — no matching data found.

UI rendering tips

Conflict card (per component):

Header: {type} · {api_name}

Badges: severity, risk_score, latest_owner

Body:

“Stories touching this component”: table of involved_stories with columns

US (link to Copado), Jira, Developer, Last Commit Date, Action/Status, Commit (short SHA clickable)

Recommendation box (action + steps)

Footer: Deploy order hint as a pills row

Story-to-Story list:

Each row: story1_id (developer) ↔ story2_id (developer) · shared components count

Badge: needs_coordination

Field reference
component_conflicts[]

component — canonical component snapshot

api_name, type, status, last_commit_date, created_by, unique_id, user_story_id

severity — "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | "BLOCKER"

risk_score — numeric (config-driven; higher = riskier)

risk_factors — string[]

latest_owner — US ID with latest commit on this component

deploy_order_hint — string[] of US IDs sorted oldest → latest

recommendation — actionable instruction block

involved_stories[] — UI should render this detail

Story fields: name, title, environment, developer, jira_key, story_points, close_date

Per-story component fields: component_action, component_status, component_category, module_directory

Audit: last_commit_date, created_by, last_modified_by, created_date, last_modified_date

Git: commit_url, commit_sha

stories_with_commit_info[] — time-ordered source list (can be hidden by default)

story_conflicts[]

story1_id, story1_developer, story2_id, story2_developer

shared_components[], shared_count

needs_coordination — true when multi-dev or risky type overlaps

summary

stories, components

component_conflicts, story_conflicts

detail — extra stats (totals, severity breakdown, avg risk)

Example flows
A) Analyze three User Stories and render a single conflicted component

Call POST /api/analyze-sf with the US IDs.

For each item in component_conflicts:

Show a component card with the header and badges.

Render a table of involved stories with columns:

US (name) · Jira (jira_key) · Developer · Commit Date · Action/Status · Commit Link (short SHA)

Render the Recommendation box.

Render Deploy Order pills using deploy_order_hint.

B) Show story-to-story overlaps view

List each pair; clicking a row filters the main list to that pair’s shared component(s).

UI error handling

If component_conflicts.length === 0 and story_conflicts.length === 0, show an “All clear” checkmark with counts from summary.

If 401, show “Salesforce login failed” with a “Try again” and a link to settings (where configJsonPath or env creds can be updated).

If 400, display the error message inline near the input form.

Performance recommendations

Debounce user actions; call the API once per scope change.

Streamline rendering by collapsing stories_with_commit_info by default; expand on click.

If the UI frequently repeats the same scope, you can cache the last request client-side for a few minutes.

Backend already:

Batches Salesforce queries.

Enriches data in memory.

Writes a debug CSV (can be disabled in production UI).

Testing snippets
# Analyze by user stories
curl -s -X POST http://localhost:5000/api/analyze-sf \
  -H "Content-Type: application/json" \
  -d '{"userStoryNames":"US-0033466,US-0033526,US-0033692"}' | jq

# Analyze by release
curl -s -X POST http://localhost:5000/api/analyze-sf \
  -H "Content-Type: application/json" \
  -d '{"releaseNames":"SFDC-PEAC-B2C 25.21.1"}' | jq

FAQ

Q: Sometimes developer is empty.
A: We fill from CreatedBy.Name → LastModifiedBy.Name → commit’s created_by when the primary Copado developer field is blank. You’ll still get a value in most cases.

Q: Sometimes jira_key is empty.
A: We read copado__User_Story__r.copadoccmint__JIRA_key__c (plus common alternates). If your org uses a different field, tell us and we’ll add it.

Q: Can we block older-than-production stories?
A: Yes. The backend supports an optional org-state regression guard design. If you want it in the UI, we’ll expose blocked and block_story_ids in this response and mark those stories with a BLOCKED badge.

If you want this as a Markdown file in your repo (/docs/ui-integration.md), say the word and I’ll output