# 🚀 Copado Deployment Validator

An enterprise-grade tool for analyzing Copado deployments, detecting conflicts, and calculating deployment risks.

## 📊 Project Status

**Phase 1: CSV Analysis & API** ✅ COMPLETE  
**Phase 2: Bot Automation** ⏳ PLANNED

---

## 🎯 What This Tool Does

### Problem Solved
When multiple developers modify the same Salesforce components in Copado, deployment conflicts occur. This tool:
- Parses Copado CSV exports
- Identifies components touched by multiple user stories
- Calculates risk scores (0-100)
- Classifies conflicts by severity (LOW → BLOCKER)
- Provides actionable recommendations

### Real Results
From actual deployment analysis:
- **78 records** analyzed
- **24 conflicts** detected
- **1 BLOCKER** (95/100 risk score)
- **5 CRITICAL** conflicts
- **23 user stories** affected

---

## 🏗️ Architecture

────────────────────────────────────────────────────────┐
│                    FRONTEND LAYER                        │
│  Simple HTML/CSS/JS - Drag & Drop CSV Upload            │
└────────────────────┬────────────────────────────────────┘
│
│ HTTP/JSON API
│
┌────────────────────▼────────────────────────────────────┐
│                   BACKEND API (Flask)                    │
│  - POST /api/analyze - Upload & analyze CSV             │
│  - GET  /api/health  - Health check                     │
└────────────────────┬────────────────────────────────────┘
│
┌────────────┴────────────┐
│                         │
┌───────▼────────┐    ┌──────────▼──────────┐
│  CSV Parser    │    │ Conflict Detector    │
│  (Pandas)      │    │ (Risk Scoring)       │
└────────────────┘    └─────────────────────┘

---

## 📁 Project Structure
salesforce-conflict-analyzer/
├── backend/
│   ├── venv/                    # Python virtual environment
│   ├── app.py                   # Flask REST API
│   ├── models.py                # Data models (dataclasses)
│   ├── csv_parser.py            # CSV parsing logic
│   ├── conflict_detector.py     # Conflict detection algorithm
│   ├── test_parser.py           # Parser tests
│   ├── test_detector.py         # Detector tests
│   └── requirements.txt         # Python dependencies
├── frontend/
│   ├── index.html               # Main UI
│   ├── style.css                # Styling
│   └── app.js                   # Frontend logic
├── data/
│   └── sep_10th_component_list.csv  # Test data
├── README.md                    # This file
└── PROGRESS.md                  # Detailed progress log

---

## 🚀 Quick Start

### Prerequisites
- Python 3.8+
- pip
- Modern web browser

### Setup Backend
```bash
# Navigate to backend
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start API server
flask --app app run --debug --host=0.0.0.0 --port=5000
Server runs on: http://localhost:5000
Setup Frontend
bash# Navigate to frontend
cd frontend

# Open in browser (Mac)
open index.html

# Or Windows
start index.html

# Or just double-click index.html

📊 API Documentation
Health Check
bashGET /api/health
Response:
json{
  "status": "healthy",
  "service": "Copado Deployment Validator API",
  "version": "1.0.0"
}
Analyze CSV
bashPOST /api/analyze
Content-Type: multipart/form-data

file: [CSV file]
Response:
json{
  "success": true,
  "data": {
    "summary": {
      "total_records": 78,
      "unique_stories": 23,
      "total_conflicts": 24,
      "avg_risk_score": 43.5,
      "severity_breakdown": {
        "blocker": 1,
        "critical": 5,
        "high": 8,
        "medium": 9,
        "low": 1
      }
    },
    "conflicts": [...]
  }
}

🧪 Testing
Test CSV Parser
bashcd backend
python3 test_parser.py
Test Conflict Detector
bashpython3 test_detector.py
Test API with curl
bash# Health check
curl http://localhost:5000/api/health

# Upload CSV
curl -X POST -F "file=@../data/sep_10th_component_list.csv" \
  http://localhost:5000/api/analyze

🎓
START: Analyze Story US-XXXXX
  │
  ├─► STEP 1: Regression Check
  │     │
  │     ├─► Any component older than production?
  │     │     YES → ❌ BLOCKED
  │     │          └─► Stop analysis
  │     │          └─► Action: Update from prod
  │     │     NO  → Continue
  │     │
  ├─► STEP 2: Component Conflict Check
  │     │
  │     ├─► Any component shared with other stories?
  │     │     NO  → ✅ SAFE
  │     │          └─► Action: Standard deployment
  │     │     YES → Continue to risk scoring
  │     │
  ├─► STEP 3: Risk Scoring (Per Component)
  │     │
  │     ├─► Calculate risk factors:
  │     │     • Multiple stories? (+20)
  │     │     • Multiple developers? (+20)
  │     │     • Critical component type? (+25)
  │     │     • Copado flagged? (+30)
  │     │     • Recent changes? (+15)
  │     │
  │     ├─► Total risk = 0-100
  │     │
  │     ├─► Map to severity:
  │     │     81-100 → BLOCKER
  │     │     61-80  → CRITICAL
  │     │     41-60  → HIGH
  │     │     21-40  → MEDIUM
  │     │     0-20   → LOW
  │     │
  ├─► STEP 4: Story-Level Status
  │     │
  │     ├─► Take HIGHEST severity from all components
  │     │
  │     ├─► BLOCKER/CRITICAL?
  │     │     YES → ❌ BLOCKED or ⚠️ WARNING
  │     │          └─► Action: Manual coordination
  │     │     NO  → ✅ SAFE
  │     │
  ├─► STEP 5: Deployment Order (if conflicts exist)
  │     │
  │     ├─► FOR each shared component:
  │     │     • Compare commit dates
  │     │     • Assign severity weight
  │     │     • Calculate: +weight if latest, -weight if older
  │     │
  │     ├─► Sum weighted scores
  │     │     Positive → Deploy LAST
  │     │     Negative → Deploy FIRST
  │     │     Zero     → Coordinate manually
  │     │
  └─► FINAL: Return verdict
        • Status: BLOCKED / WARNING / SAFE
        • Actions: What developer must do
        • Order: When to deploy (first/last/coordinate)
        • Coordination: Who to sync with



┌─────────────────────────────────────────────────────────────┐
│             USER UPLOADS TWO CSV FILES                      │
│  1. UAT Deployment CSV (stories to deploy)                 │
│  2. Production CSV (current prod state) [optional]          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                   PARSE & VALIDATE                          │
│  • Extract user stories (id, title, developer, components) │
│  • Extract components (name, type, commit date, status)    │
│  • Build production component index (name → commit date)   │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              BUILD COMPONENT-TO-STORIES INDEX               │
│                                                             │
│  For each component:                                        │
│    Component Name → [Story1, Story2, Story3...]            │
│                                                             │
│  Example:                                                   │
│    ApexClass.OrderHelper → [US-0001, US-0002, US-0005]    │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│            DETECT CONFLICTS (Per Component)                 │
│                                                             │
│  IF component touched by 2+ stories:                       │
│    ✓ Conflict detected                                     │
│    ✓ Store all involved stories                            │
│    ✓ Proceed to risk scoring                               │
│  ELSE:                                                      │
│    ✓ No conflict                                           │
│    ✓ Mark story as SAFE                                    │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│         REGRESSION CHECK (Per Component)                    │
│                                                             │
│  IF production CSV provided:                               │
│    FOR each component in story:                            │
│      IF component exists in production:                    │
│        Compare commit dates:                               │
│          Deploy Date < Prod Date?                          │
│            YES → REGRESSION DETECTED                       │
│                  Story = BLOCKED                           │
│                  Stop further analysis                     │
│            NO  → Safe (newer or equal)                     │
│      ELSE:                                                 │
│        New component (not in prod yet)                     │
│        Mark as SAFE                                        │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│         RISK SCORING (For Each Conflict)                   │
│                                                             │
│  Calculate risk score (0-100) based on 5 factors:         │
│                                                             │
│  Factor 1: Number of Stories                               │
│    • 2 stories  → +20 points                               │
│    • 3+ stories → +20 points per extra story               │
│                                                             │
│  Factor 2: Multiple Developers                             │
│    • 2+ developers → +20 points                            │
│                                                             │
│  Factor 3: Component Type (Critical?)                      │
│    • ApexClass, IntegrationProcedure, Flow → +25 points   │
│                                                             │
│  Factor 4: Copado Conflict Status                         │
│    • "Potential Conflict" flagged → +30 points            │
│                                                             │
│  Factor 5: Commit Age                                      │
│    • Recent changes (<7 days) → +15 points                │
│                                                             │
│  Total Risk Score = Sum of all factors (max 100)          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│         SEVERITY CLASSIFICATION (Per Conflict)              │
│                                                             │
│  Map risk score to severity:                               │
│    0-20   → LOW                                            │
│    21-40  → MEDIUM                                         │
│    41-60  → HIGH                                           │
│    61-80  → CRITICAL                                       │
│    81-100 → BLOCKER                                        │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│         STORY-LEVEL STATUS (Aggregate Per Story)            │
│                                                             │
│  For each story, determine final status:                   │
│                                                             │
│  IF hasRegression:                                         │
│    Status = BLOCKED                                        │
│    Action = "Update commit from production"                │
│                                                             │
│  ELSE IF any component severity = BLOCKER:                 │
│    Status = BLOCKED                                        │
│    Action = "Manual merge required"                        │
│                                                             │
│  ELSE IF any component severity = CRITICAL:                │
│    Status = WARNING                                        │
│    Action = "Coordinate with developers"                   │
│                                                             │
│  ELSE IF any component risk >= 60:                         │
│    Status = WARNING                                        │
│    Action = "Deploy in sequence, test thoroughly"          │
│                                                             │
│  ELSE:                                                     │
│    Status = SAFE                                           │
│    Action = "Follow standard deployment"                   │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│   DEPLOYMENT ORDER (For Stories with Shared Components)    │
│                                                             │
│  For stories with conflicts, determine deployment order:   │
│                                                             │
│  Step 1: Assign severity weights                          │
│    • BLOCKER/CRITICAL → 5 points                          │
│    • HIGH             → 3 points                          │
│    • MEDIUM           → 2 points                          │
│    • LOW              → 1 point                           │
│                                                             │
│  Step 2: Calculate weighted score per story               │
│    FOR each shared component:                              │
│      IF story has latest commit:                          │
│        Score += weight                                     │
│      ELSE:                                                 │
│        Score -= weight                                     │
│                                                             │
│  Step 3: Determine order based on score                   │
│    IF score > 0:                                           │
│      Deploy LAST (preserve your critical changes)         │
│    ELSE IF score < 0:                                      │
│      Deploy FIRST (others have critical changes)          │
│    ELSE:                                                   │
│      COORDINATE (tie - manual decision)                    │
│                                                             │
│  Example:                                                  │
│    Component A (CRITICAL): Other story latest → -5        │
│    Component B (MEDIUM):   You have latest    → +2        │
│    Total Score: -3                                         │
│    Decision: Deploy FIRST                                  │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              GENERATE DEPLOYMENT BATCHES                    │
│                                                             │
│  Batch 1: SAFE Stories                                     │
│    • No conflicts detected                                 │
│    • No regressions                                        │
│    • Can deploy immediately                                │
│                                                             │
│  Batch 2: WARNING Stories                                  │
│    • Medium/High risk conflicts                            │
│    • Requires coordination                                 │
│    • Deploy after Batch 1, in sequence                     │
│                                                             │
│  Excluded: BLOCKED Stories                                 │
│    • Regression risks                                      │
│    • Blocker conflicts                                     │
│    • Cannot deploy until fixed                             │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                 PRESENT RESULTS                             │
│                                                             │
│  Developer View:                                           │
│    • Filter by developer name                              │
│    • Show only their stories                               │
│    • Display: Status, Actions, Deployment Order            │
│    • Simple verdicts: "Can I deploy?"                      │
│                                                             │
│  DevOps View:                                              │
│    Tab 1: Overview (summary stats)                         │
│    Tab 2: All Stories (filterable list)                    │
│    Tab 3: Deployment Plan (batch sequences)                │
│    Tab 4: Enforcement (policy violations)                  │
└─────────────────────────────────────────────────────────────┘