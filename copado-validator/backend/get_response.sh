#!/bin/bash

# Edit this to your backend URL
BACKEND="http://localhost:5000"
# If your backend is remote, use:
# BACKEND="https://your-backend-url.com"

echo "🧪 Testing 6 Backend APIs"
echo "Backend: $BACKEND"
echo ""

# Create output file
OUTPUT_FILE="api_responses.txt"
> $OUTPUT_FILE

# Test 1
echo "1️⃣ /api/analyze-sf"
echo "=== /api/analyze-sf ===" >> $OUTPUT_FILE
curl -s -X POST $BACKEND/api/analyze-sf \
  -H "Content-Type: application/json" \
  -d '{
    "userStoryNames": ["STORY-001"],
    "releaseNames": "Release-1"
  }' >> $OUTPUT_FILE 2>&1
echo "" >> $OUTPUT_FILE

# Test 2
echo "2️⃣ /api/analyze-stories"
echo "=== /api/analyze-stories ===" >> $OUTPUT_FILE
curl -s -X POST $BACKEND/api/analyze-stories \
  -H "Content-Type: application/json" \
  -d '{
    "userStoryNames": ["STORY-001"]
  }' >> $OUTPUT_FILE 2>&1
echo "" >> $OUTPUT_FILE

# Test 3
echo "3️⃣ /api/production-state"
echo "=== /api/production-state ===" >> $OUTPUT_FILE
curl -s -X POST $BACKEND/api/production-state \
  -H "Content-Type: application/json" \
  -d '{
    "branch": "master",
    "components": [{"type": "ApexClass", "name": "MyClass"}]
  }' >> $OUTPUT_FILE 2>&1
echo "" >> $OUTPUT_FILE

# Test 4
echo "4️⃣ /api/component-history"
echo "=== /api/component-history ===" >> $OUTPUT_FILE
curl -s -X POST $BACKEND/api/component-history \
  -H "Content-Type: application/json" \
  -d '{
    "components": ["MyClass"],
    "limit": 5
  }' >> $OUTPUT_FILE 2>&1
echo "" >> $OUTPUT_FILE

# Test 5
echo "5️⃣ /api/compare-orgs"
echo "=== /api/compare-orgs ===" >> $OUTPUT_FILE
curl -s -X POST $BACKEND/api/compare-orgs \
  -H "Content-Type: application/json" \
  -d '{
    "components": ["MyClass"],
    "source_branch": "development",
    "target_branch": "production"
  }' >> $OUTPUT_FILE 2>&1
echo "" >> $OUTPUT_FILE

# Test 6
echo "6️⃣ /api/get-code-diff"
echo "=== /api/get-code-diff ===" >> $OUTPUT_FILE
curl -s -X POST $BACKEND/api/get-code-diff \
  -H "Content-Type: application/json" \
  -d '{
    "component": "MyClass",
    "source_branch": "development",
    "target_branch": "production"
  }' >> $OUTPUT_FILE 2>&1
echo "" >> $OUTPUT_FILE

echo "✅ Done! Responses in: $OUTPUT_FILE"
cat $OUTPUT_FILE
