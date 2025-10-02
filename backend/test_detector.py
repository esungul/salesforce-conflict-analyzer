"""
Test conflict detector with real CSV data
"""

from csv_parser import CopadoCSVParser
from conflict_detector import ConflictDetector

# Step 1: Parse CSV
print("Parsing CSV...")
parser = CopadoCSVParser()
result = parser.parse_file('../data/sep_10th_component_list.csv')
print(f"✓ Parsed {result.unique_stories} stories\n")

# Step 2: Detect conflicts
print("Detecting conflicts...")
detector = ConflictDetector(result.user_stories)
conflicts = detector.detect_conflicts()
print(f"✓ Found {len(conflicts)} conflicts\n")

# Step 3: Get summary
summary = detector.get_conflict_summary(conflicts)

print("=" * 70)
print("CONFLICT ANALYSIS SUMMARY")
print("=" * 70)
print(f"Total Conflicts: {summary['total_conflicts']}")
print(f"Affected Stories: {summary['affected_stories']}")
print(f"Average Risk Score: {summary['avg_risk_score']:.1f}/100")
print()
print("Severity Breakdown:")
print(f"  🔴 BLOCKER:  {summary['severity_breakdown']['blocker']}")
print(f"  🟠 CRITICAL: {summary['severity_breakdown']['critical']}")
print(f"  🟡 HIGH:     {summary['severity_breakdown']['high']}")
print(f"  🔵 MEDIUM:   {summary['severity_breakdown']['medium']}")
print(f"  🟢 LOW:      {summary['severity_breakdown']['low']}")
print()

# Step 4: Show top 5 highest risk conflicts
print("=" * 70)
print("TOP 5 HIGHEST RISK CONFLICTS")
print("=" * 70)

for i, conflict in enumerate(conflicts[:5], 1):
    severity_emoji = {
        'BLOCKER': '🔴',
        'CRITICAL': '🟠',
        'HIGH': '🟡',
        'MEDIUM': '🔵',
        'LOW': '🟢'
    }
    
    emoji = severity_emoji.get(conflict.severity.name, '⚪')
    
    print(f"\n{i}. {emoji} {conflict.component.api_name}")
    print(f"   Type: {conflict.component.type.value}")
    print(f"   Risk Score: {conflict.risk_score}/100 ({conflict.severity.name})")
    print(f"   Stories Involved: {len(conflict.involved_stories)}")
    for story in conflict.involved_stories:
        print(f"     • {story.id}: {story.title[:50]}...")
    print(f"   Risk Factors:")
    for factor in conflict.risk_factors:
        print(f"     • {factor}")