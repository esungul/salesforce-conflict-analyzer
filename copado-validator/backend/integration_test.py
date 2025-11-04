# test_pattern.py
import re

test_strings = [
    "Apple iPad 9th Gen 10.2 inch (LLA_Apple_iPad_9th_Gen_2021_64GB / 35121504-36d6-7cf1-2cad-9e129a18598f)",
    "Samsung Galaxy S25 Ultra (LLA_Samsung_Galaxy_S25_Ultra / 9d95bc32-06da-b97f-60ce-808047f576bd)"
]

pattern = "\\(([^/]+)"

print("🧪 Testing Pattern Matching:")
print("=" * 80)

for test_string in test_strings:
    match = re.search(pattern, test_string)
    if match:
        print(f"✅ INPUT:  {test_string}")
        print(f"   MATCH:  '{match.group(1)}'")
    else:
        print(f"❌ INPUT:  {test_string}")
        print(f"   NO MATCH for pattern: {pattern}")
    print("-" * 60)