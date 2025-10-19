# Overview
This guide documents the backend APIs and flows the frontend should use to analyze Copado user stories and component conflicts. The system supports two **data sources**:

1. **CSV Upload (existing):** Upload a CSV containing `copado__User_Story_Metadata__c` exports.
2. **Salesforce Online (new):** Query Salesforce live by Release Name(s) **or** User Story Name(s).

Both return the **same response shape**, so the UI can reuse the same result rendering components.

---

# Base URL
```
http://<host>:<port>
```
(Dev default is `http://localhost:5000`.)

---

# Endpoints

## 1) Analyze via CSV (existing)
**POST** `/api/analyze`

**Content-Type:** `multipart/form-data`

**Form fields:**
- `file` – CSV file containing the Copado export

**Response 200:**
```json
{
  "summary": {
    "stories": 42,
    "components": 128,
    "component_conflicts": 5,
    "story_conflicts": 2
  },
  "component_conflicts": [ ... ],
  "story_conflicts": [ ... ]
}
```

**Typical Errors:**
- `400` – Missing/invalid file
- `500` – CSV parsing or internal error

---

## 2) Analyze via Salesforce (online)
**POST** `/api/analyze-sf`

**Content-Type:** `application/json`

**Request Body (one of the following is required):**
```json
{
  "releaseNames": ["SFDC-PEAC-B2C 25.21.1"],
  "configJsonPath": "/path/to/sf.json"
}
```
_or_
```json
{
  "userStoryNames": ["US-12345", "US-67890"]
}
```

Rules:
- `releaseNames` **or** `userStoryNames` must be provided (not both required).
- Each can be a **string** or an **array of strings**.
- If both are provided, the backend **prefers** `releaseNames`.
- Optional: `configJsonPath` overrides env-based SF credentials (dev-only).

**Response 200:**
```json
{
  "summary": {
    "stories": 10,
    "components": 24,
    "component_conflicts": 3,
    "story_conflicts": 1,
    "detail": {
      "total_conflicts": 3,
      "severity_breakdown": { },
      "affected_stories": 0,
      "avg_risk_score": 0
    }
  },
  "component_conflicts": [ /* JSON-safe objects */ ],
  "story_conflicts": [ /* JSON-safe objects */ ],
  "debug_csv_path": "./tmp/online_inputs/stories_abc123.csv"
}
```

**Typical Errors:**
- `400` – Neither `releaseNames` nor `userStoryNames` provided, or wrong types
- `401` – Salesforce auth or query failure (e.g., `INVALID_LOGIN`, `MALFORMED_QUERY`)
- `500` – Internal error

> Note: The backend converts Enums, datetimes, and model objects into JSON-safe values. No UI-side custom serializers needed.

---

# UI Flow & Components

## Data Source Selector
A simple segmented control or radio group:
- **CSV Upload**
- **Salesforce (Online)**

### CSV Upload Mode
- Show a file picker.
- Submit to `POST /api/analyze` with `multipart/form-data` (key: `file`).
- On success, render conflicts using the common component.

### Salesforce (Online) Mode
- Show inputs:
  - **Release Name(s)**: free text; allow comma or newline separated list. (Leave empty if using stories.)
  - **User Story Name(s)**: free text; allow comma or newline separated list. (Leave empty if using releases.)
  - Optional **Config JSON Path**: developer-only visible field to override env creds (can be hidden in prod).
- Client-side validation: require at least one of Release or Story input to be non-empty.
- Submit to `POST /api/analyze-sf` with `application/json` body.

## Results Panel (Common)
- **Summary header** (from `response.summary`):
  - `stories`, `components`, `component_conflicts`, `story_conflicts`
  - Optional: use `summary.detail` fields if present
- **Conflicts lists**:
  - `component_conflicts`: table or cards (include component name/type, stories involved, severity/status)
  - `story_conflicts`: group by story pairs or clusters
- **Debug** (dev-only): If `debug_csv_path` present, show a small link or copy-to-clipboard button.

---

# Request/Response Examples

## Example: By Release Name (single string)
```bash
curl -X POST http://localhost:5000/api/analyze-sf \
  -H "Content-Type: application/json" \
  -d '{"releaseNames":"SFDC-PEAC-B2C 25.21.1"}'
```

## Example: By Multiple User Stories (array)
```bash
curl -X POST http://localhost:5000/api/analyze-sf \
  -H "Content-Type: application/json" \
  -d '{"userStoryNames":["US-12345","US-67890","US-13579"]}'
```

## Example: CSV Upload
```bash
curl -X POST http://localhost:5000/api/analyze \
  -F file=@/path/to/export.csv
```

---

# Field Reference (Salesforce → Parser → Conflicts)
The online path returns the same columns your CSV parser expects. Key fields mapped from `copado__User_Story_Metadata__c`:
- `copado__User_Story__r.Name`
- `copado__User_Story__r.copado__User_Story_Title__c`
- `copado__User_Story__r.copado__Release__r.Name`
- `copado__User_Story__r.copado__Project__r.Name`
- `copado__User_Story__r.copado__Developer__r.Name`
- `copado__User_Story__r.copado__Close_Date__c`
- `copado__User_Story__r.copado__Story_Points_SFDC__c`
- `copado__User_Story__r.copado__Environment__r.Name`
- `copado__Metadata_API_Name__c`
- `copado__Type__c`
- `copado__Category__c`
- `copado__Action__c`
- `copado__Status__c`
- `copado__ModuleDirectory__c`
- `copado__Last_Commit_Date__c`
- `copado__JsonInformation__c`
- `copado__Unique_ID__c`
- `CreatedDate`
- `CreatedBy.Name`
- `LastModifiedDate`
- `LastModifiedBy.Name`

> The backend normalizes SF records into this shape and feeds them into the existing CSV parser. The UI does not need to know about the CSV shim.

---

# Validation Rules (Frontend)
- In **Salesforce mode**: at least one of Release or Story input must be provided.
- If both are provided, backend prefers releases (the UI may gray out one input once the other is filled to avoid confusion).
- Empty states: show a neutral “No records found” panel if `stories=0` and `components=0`.
- Display backend `error` string directly when non-200.

---

# Status Codes
- **200** – OK (payload with summary + conflicts)
- **400** – Bad Request (missing/invalid inputs)
- **401** – Unauthorized / Salesforce error (auth or malformed SOQL)
- **500** – Internal Server Error

---

# Configuration Notes (Dev)
- SF credentials via environment:
  - `SF_USERNAME`, `SF_PASSWORD`, `SF_SECURITY_TOKEN`, `SF_DOMAIN` (default `login`)
- Optional JSON config path (dev only): `configJsonPath` in request body overrides env.

---

# UX Suggestions
- Loading state on submit; disable button while pending.
- Show counts in the header; add quick filters (by type, status, developer) client-side.
- Persist the last used data source and input values in local storage for convenience.

---

# Roadmap (Non-breaking Enhancements)
- Add `parse_rows(rows)` to parser → remove temp CSV write for faster response.
- Add server-side pagination for very large datasets (if needed).
- Improve `summary.detail` with severity distribution and top hot spots.

---

# Contact
Ping the backend team if you need sample payloads or a mock server. The `/api/analyze-sf` endpoint supports both Release and User Story inputs with identical result structures, so UI components are fully reusable across modes.

2789483