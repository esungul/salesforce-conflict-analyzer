"""
Test script for CSV parser
"""

from csv_parser import CopadoCSVParser

# Create parser
parser = CopadoCSVParser()

# Parse the CSV
result = parser.parse_file('../data/sep_10th_component_list.csv')

# Print results
print("=" * 60)
print("CSV PARSING RESULTS")
print("=" * 60)
print(f"Total Records: {result.total_records}")
print(f"Unique Stories: {result.unique_stories}")
print(f"Unique Components: {result.unique_components}")
print()

print("First 5 User Stories:")
print("-" * 60)
for story in result.user_stories[:5]:
    print(f"  {story.id}: {story.title}")
    print(f"    Developer: {story.developer}")
    print(f"    Components: {len(story.components)}")
    print()