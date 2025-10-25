
# Salesforce Multi-Org Comparison API (v2)

## Overview
This document describes the backend API response format for `/api/compare-orgs-v2`, which compares Salesforce metadata components across multiple orgs (2–4).

The API enables the frontend to display component-level and file-level differences, color-code org mismatches, and show unified diffs without client-side computation.

---

## Example Request

```json
{
  "orgs": [
    { "org": "QAorg", "branch": "qasales" },
    { "org": "UAT", "branch": "uatsfdc" },
    { "org": "Prod", "branch": "master" }
  ],
  "components": [
    { "type": "IntegrationProcedure", "name": "PR_AddUpgradeFeeAccessoryIP" }
  ],
  "include_diffs": true,
  "changed_only": true,
  "diff_base_org": "Prod",
  "unified_context": 3
}
```

---

## Response Structure

### Root Keys
| Key | Type | Description |
|------|------|-------------|
| `meta` | Object | Comparison metadata (orgs, baseline, flags). |
| `components[]` | Array | Each compared metadata component. |
| `perf` | Object | Performance metrics (duration, counts). |

---

### meta
```json
"meta": {
  "changed_only": true,
  "diff_base_org": "Prod",
  "include_diffs": true,
  "orgs": [
    {"org": "QAorg", "branch": "qasales"},
    {"org": "UAT", "branch": "uatsfdc"},
    {"org": "Prod", "branch": "master"}
  ],
  "unified_context": 3,
  "version": "v2"
}
```

---

### components[]
Each represents a metadata component being compared.

| Key | Type | Description |
|------|------|-------------|
| `type` | String | Metadata type, e.g., `IntegrationProcedure`. |
| `name` | String | Component name. |
| `summary` | Object | File counts (changed/total/unchanged). |
| `files[]` | Array | Detailed file-level comparison results. |

---

### files[]
Example entry:

```json
{
  "path": "vlocity/IntegrationProcedure/PR_AddUpgradeFeeAccessoryIP/PR_AddUpgradeFeeAccessoryIP_DataPack.json",
  "status": "DIFF",
  "base_org": "Prod",
  "per_org_meta": [
    {"org": "QAorg", "branch": "qasales", "exists": true, "line_count": 31, "sha256": "7ca..."},
    {"org": "UAT", "branch": "uatsfdc", "exists": true, "line_count": 31, "sha256": "7ca..."},
    {"org": "Prod", "branch": "master", "exists": true, "line_count": 30, "sha256": "c7b..."}
  ],
  "diff": {
    "format": "mixed",
    "items": [
      {
        "header": "@@ -1,5 +1,5 @@",
        "lines": [
          "-    \"Old line...\",",
          "+    \"New line...\""
        ]
      }
    ]
  }
}
```

#### Status meanings
| Status | Meaning |
|---------|----------|
| `ALL_SAME` | All orgs identical |
| `DIFF` | At least one org differs from baseline |
| `NEW` | Exists only in one org |
| `MISSING` | Absent in all orgs |

---

### diff object
Represents content differences between baseline and others.

`format` can be:
- `mixed`: includes unified and git-native formats
- `git_unified`: compact unified diff format
- `git_word_porcelain`: tokenized inline word diff

Each `item` contains:
```json
{
  "header": "@@ -1,5 +1,5 @@",
  "lines": [
    "- old line",
    "+ new line"
  ]
}
```

---

### per_org_meta[]
Each entry provides per-org file state:
```json
{"org":"QAorg","branch":"qasales","exists":true,"sha256":"abc123","line_count":31}
```
Frontend should compare each org’s `sha256` with the baseline to decide:
- 🟢 same
- 🟡 different
- ⚪️ missing

---

### summary
Example:
```json
"summary": {
  "files_changed": 4,
  "files_total": 11,
  "files_unchanged": 7
}
```

---

## UI Mapping Suggestions

| UI Element | JSON Source | Example |
|-------------|--------------|----------|
| Header chips | `meta.orgs[]` | QAorg/qasales, UAT/uatsfdc, Prod/master |
| Baseline label | `meta.diff_base_org` | Prod |
| Changed count | `component.summary.files_changed` | 4 |
| File table | `component.files[]` | Render path, status, per-org dots |
| Diff modal | `file.diff.items[].lines` | Render unified diff lines |

---

## TypeScript Interface

```ts
interface CompareResponse {
  meta: {
    changed_only: boolean;
    diff_base_org: string;
    include_diffs: boolean;
    orgs: { org: string; branch: string }[];
    unified_context: number;
    version: string;
  };
  components: ComponentCompare[];
  perf: { components: number; total_ms: number };
}

interface ComponentCompare {
  type: string;
  name: string;
  summary: { files_changed: number; files_total: number; files_unchanged: number };
  files: FileCompare[];
}

interface FileCompare {
  path: string;
  status: 'ALL_SAME' | 'DIFF' | 'NEW' | 'MISSING';
  base_org: string;
  per_org_meta: { org: string; branch: string; exists: boolean; sha256?: string; line_count?: number }[];
  diff?: { format: string; items: DiffItem[] };
}

interface DiffItem {
  header?: string;
  lines?: string[];
  hunks?: { header: string; lines: string[] }[];
  chunks?: { type: 'add' | 'del' | 'ctx'; text: string }[];
}
```

---

## Example Diff Visualization

```diff
--- Prod:master:vlocity/.../PR_AddUpgradeFeeAccessoryIP_DataPack.json
+++ QAorg:qasales:vlocity/.../PR_AddUpgradeFeeAccessoryIP_DataPack.json
@@ -1,5 +1,5 @@
 {
-   "%vlocity_namespace%__AdditionalInformation__c": "Used to add upgrade fee...",
+   "%vlocity_namespace%__AdditionalInformation__c": "Used to add upgrade fee... Added Price override step & inputs QA-215703",
@@ -10,6 +10,7 @@
     "PR_AddUpgradeFeeAccessoryIP_Element_updateFeeDetails.json",
+    "PR_AddUpgradeFeeAccessoryIP_Element_OneTimePriceOverride.json",
```

---

## Performance Object

```json
"perf": {
  "components": 2,
  "total_ms": 27169
}
```

Indicates how long the comparison took (useful for logs/monitoring).

---

**Author:** Salesforce Conflict Analyzer Project  
**Version:** v2 (multi-org + Git diff support)  
**Last Updated:** October 2025
