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

🎓 Risk Scoring Algorithm
Risk Factors (Max 100 points)
FactorWeightDescriptionMultiple Developers+20Different developers = communication overheadCritical Component+25ApexClass, IntegrationProcedure, FlowCopado Flagged+30"Potential Conflict" statusMany Stories+203+ stories touching same componentRecent Changes+15Modified within last 7 days
Severity Classification
ScoreSeverityAction Required0-20🟢 LOWSafe to deploy21-40🔵 MEDIUMQuick review recommended41-60🟡 HIGHCareful testing required61-80🟠 CRITICALHigh risk - extensive testing81-100🔴 BLOCKERManual merge required