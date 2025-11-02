"""
UI-FRIENDLY RESPONSE STRUCTURE
================================

When processing 100 stories, we need:
1. Quick overview at the top (aggregated stats)
2. Per-story summaries (table-friendly)
3. Detailed data available but not in main response
4. Easy filtering/sorting
5. Pagination support
"""

# =============================================================================
# NEW RESPONSE STRUCTURE
# =============================================================================

{
  # ========== OVERVIEW (Top of UI) ==========
  "overview": {
    "total_stories": 100,
    "processing_time": "0:02:15",
    "timestamp": "2025-10-28T20:49:35.012893",
    
    # Quick stats
    "summary": {
      "proven": 85,
      "unproven": 10,
      "partial": 5,
      "success_rate": 85.0
    },
    
    # Validation stats
    "validation_summary": {
      "all_validators_passed": 80,
      "some_validators_failed": 15,
      "critical_failures": 5
    },
    
    # Component stats
    "component_summary": {
      "total_components": 450,
      "proven_components": 400,
      "unproven_components": 50,
      "component_types": {
        "ApexClass": 150,
        "LightningComponentBundle": 200,
        "ApexTrigger": 50,
        "PermissionSet": 50
      }
    }
  },
  
  # ========== STORIES LIST (Main Table/Grid) ==========
  "stories": [
    {
      # Story identification
      "story_id": "US-0033638",
      "story_name": "US-0033638",
      "story_url": "https://jira.company.com/browse/US-0033638",
      
      # Status indicators (for badges/colors)
      "status": "proven",  // proven | unproven | partial | error
      "confidence": "very high",  // very high | high | medium | low | very low
      "proof_score": 100.0,
      
      # Quick metrics (for table columns)
      "metrics": {
        "components_total": 4,
        "components_proven": 4,
        "validators_passed": 4,
        "validators_failed": 0,
        "validators_total": 4
      },
      
      # Commit info
      "commit": {
        "sha": "910e4e2d",
        "sha_full": "910e4e2dde632ee505f55393d10c2a16d97d4ad4",
        "author": "Shivani Soni",
        "date": "2025-10-10T05:34:34+00:00",
        "message": "US-0033638: QA deployment - QA-211994",
        "url": "https://bitbucket.org/workspace/repo/commits/910e4e2d"
      },
      
      # Environment
      "environment": "production",
      
      # Execution time
      "execution_time": "0:00:02.155713",
      "execution_time_ms": 2156,
      
      # Components summary (expandable in UI)
      "components": [
        {
          "name": "prDeviceTile",
          "type": "LightningComponentBundle",
          "proven": true,
          "confidence": "very high"
        },
        {
          "name": "prWearableTile",
          "type": "LightningComponentBundle",
          "proven": true,
          "confidence": "very high"
        }
      ],
      
      # Validation results (expandable in UI)
      "validation": {
        "status": "passed",  // passed | failed | partial
        "validators": [
          {
            "name": "commit_exists",
            "status": "success",
            "icon": "✅"
          },
          {
            "name": "component_exists",
            "status": "success",
            "icon": "✅"
          },
          {
            "name": "component_timestamp",
            "status": "success",
            "icon": "✅"
          },
          {
            "name": "file_mapping",
            "status": "success",
            "icon": "✅"
          }
        ]
      },
      
      # Quick notes (first few lines, expandable)
      "notes_preview": [
        "📦 Commit: 910e4e2d",
        "👤 Author: Shivani Soni",
        "📊 Summary: 16 files, 4 components"
      ],
      
      # Link to detailed view
      "details_url": "/api/deployment/prove/story/US-0033638/details"
    }
    // ... 99 more stories
  ],
  
  # ========== FILTERS (For UI filtering) ==========
  "filters": {
    "statuses": ["proven", "unproven", "partial"],
    "environments": ["production"],
    "component_types": ["LightningComponentBundle", "ApexClass", "ApexTrigger"],
    "authors": ["Shivani Soni", "John Developer", "Jane Smith"],
    "date_range": {
      "earliest": "2025-10-01T00:00:00Z",
      "latest": "2025-10-28T20:49:35Z"
    }
  },
  
  # ========== ERRORS (If any) ==========
  "errors": [
    {
      "story_id": "US-0012345",
      "error_type": "story_not_found",
      "message": "Story not found in Jira",
      "severity": "error"
    }
  ],
  
  # ========== PAGINATION (For large datasets) ==========
  "pagination": {
    "page": 1,
    "page_size": 50,
    "total_pages": 2,
    "total_items": 100,
    "has_next": true,
    "has_previous": false,
    "next_url": "/api/deployment/prove/bulk?page=2",
    "previous_url": null
  }
}


# =============================================================================
# DETAILED VIEW ENDPOINT (Separate)
# =============================================================================

# When user clicks on a story for details:
# GET /api/deployment/prove/story/{story_id}/details

{
  "story_id": "US-0033638",
  "story_name": "US-0033638",
  
  # Full validation results
  "validation": {
    "results": [
      {
        "validator": "commit_exists",
        "status": "success",
        "execution_time_ms": 583,
        "details": {
          "commit_sha": "910e4e2d",
          "author": "Shivani Soni",
          "exists": true,
          "message": "US-0033638: QA deployment - QA-211994"
        }
      },
      {
        "validator": "commit_contents",
        "status": "success",
        "notes": [
          "📦 Commit: 910e4e2d",
          "👤 Author: Shivani Soni",
          "📊 Summary: 16 files changed",
          // ... full notes
        ]
      }
      // ... all validators
    ]
  },
  
  # Full component details
  "components": [
    {
      "name": "prDeviceTile",
      "type": "LightningComponentBundle",
      "proven": true,
      "confidence": "very high",
      "methods": ["git_commit_verification", "salesforce_component_query", "timestamp_comparison"],
      "method_details": [
        // Full details
      ]
    }
  ],
  
  # Full notes
  "notes": [
    // All notes from commit_contents validator
  ]
}


# =============================================================================
# EXAMPLE: 100 STORIES RESPONSE
# =============================================================================

{
  "overview": {
    "total_stories": 100,
    "processing_time": "0:02:15",
    "summary": {
      "proven": 85,
      "unproven": 10,
      "partial": 5,
      "success_rate": 85.0
    },
    "component_summary": {
      "total_components": 450,
      "proven_components": 400
    }
  },
  
  "stories": [
    {
      "story_id": "US-0033638",
      "status": "proven",
      "confidence": "very high",
      "proof_score": 100.0,
      "metrics": {
        "components_total": 4,
        "components_proven": 4,
        "validators_passed": 4,
        "validators_failed": 0
      },
      "commit": {
        "sha": "910e4e2d",
        "author": "Shivani Soni",
        "date": "2025-10-10T05:34:34+00:00"
      },
      "execution_time_ms": 2156
    },
    {
      "story_id": "US-0033639",
      "status": "proven",
      "confidence": "high",
      "proof_score": 85.0,
      "metrics": {
        "components_total": 2,
        "components_proven": 2,
        "validators_passed": 3,
        "validators_failed": 1
      },
      "commit": {
        "sha": "a3f5b2c8",
        "author": "John Developer",
        "date": "2025-10-15T14:22:10+00:00"
      },
      "execution_time_ms": 1523
    }
    // ... 98 more stories
  ],
  
  "pagination": {
    "page": 1,
    "page_size": 50,
    "total_pages": 2,
    "total_items": 100,
    "has_next": true
  }
}


# =============================================================================
# UI COMPONENT EXAMPLES
# =============================================================================

# TABLE VIEW
"""
╔═══════════════╦════════╦═══════════╦═════════════╦═══════════╦════════════╗
║ Story ID      ║ Status ║ Score     ║ Components  ║ Author    ║ Date       ║
╠═══════════════╬════════╬═══════════╬═════════════╬═══════════╬════════════╣
║ US-0033638    ║ ✅ 100 ║ 4/4       ║ 4/4         ║ S. Soni   ║ Oct 10     ║
║ US-0033639    ║ ✅ 85  ║ 3/4       ║ 2/2         ║ J. Dev    ║ Oct 15     ║
║ US-0033640    ║ ⚠️  60 ║ 3/4       ║ 2/3         ║ J. Smith  ║ Oct 18     ║
║ US-0033641    ║ ❌ 0   ║ 0/4       ║ 0/5         ║ M. Lee    ║ Oct 20     ║
╚═══════════════╩════════╩═══════════╩═════════════╩═══════════╩════════════╝

Showing 1-50 of 100 stories     [Prev] [1] [2] [Next]
"""

# CARD VIEW
"""
┌──────────────────────────────────────────┐
│ US-0033638                          ✅ 100│
│ Shivani Soni • Oct 10                    │
├──────────────────────────────────────────┤
│ 4 components • 4 validators passed       │
│ LightningComponentBundle (4)             │
│                                          │
│ [View Details]                           │
└──────────────────────────────────────────┘
"""

# SUMMARY DASHBOARD
"""
┌─────────────────────────────────────────────────┐
│          DEPLOYMENT PROOF OVERVIEW              │
├─────────────────────────────────────────────────┤
│  Total Stories: 100                             │
│  ✅ Proven: 85 (85%)                            │
│  ⚠️  Partial: 10 (10%)                          │
│  ❌ Unproven: 5 (5%)                            │
│                                                 │
│  Total Components: 450                          │
│  ✅ Proven: 400 (89%)                           │
│  ❌ Unproven: 50 (11%)                          │
│                                                 │
│  Processing Time: 2m 15s                        │
│  Average per Story: 1.35s                       │
└─────────────────────────────────────────────────┘
"""
