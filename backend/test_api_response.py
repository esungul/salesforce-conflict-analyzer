from csv_parser import CopadoCSVParser
from conflict_detector import ConflictDetector
from app import format_conflict

parser = CopadoCSVParser()
result = parser.parse_file('../data/sep_10th_component_list.csv')

detector = ConflictDetector(result.user_stories)
conflicts = detector.detect_conflicts()

# Check first conflict
conflict = conflicts[0]
print("Component:", conflict.component.api_name)
print("Has stories_with_commit_info?", hasattr(conflict, 'stories_with_commit_info'))

if hasattr(conflict, 'stories_with_commit_info'):
    print("\nStories with commit info:")
    for item in conflict.stories_with_commit_info:
        print(f"  Story: {item['story'].id}")
        print(f"  Commit Date: {item['commit_date']}")
        print(f"  Created By: {item['created_by']}")
        print()

# Format it
formatted = format_conflict(conflict)
print("\nFormatted JSON:")
import json
print(json.dumps(formatted, indent=2, default=str))