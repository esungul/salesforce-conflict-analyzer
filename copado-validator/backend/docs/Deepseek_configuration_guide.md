
🎯 GUIDE: How to Add New Components
Here's a step-by-step guide for adding any new component to the system:

📋 Quick Reference Card
text
┌─────────────────────────────────────────────────────────────┐
│                  ADDING NEW COMPONENTS GUIDE                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. IDENTIFY Component Type & Salesforce Object            │
│  2. CONFIGURE vlocity_config.yaml                          │
│  3. MAP component_types.yaml                               │
│  4. TEST Transformation & Queries                          │
│  5. VALIDATE End-to-End                                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
🚀 Step-by-Step Process
Step 1: Identify Component Structure
Ask these questions:

What's the Salesforce Object? (e.g., vlocity_cmt__MyComponent__c)

What field stores the unique name? (e.g., Name, DeveloperName, CustomField__c)

What's the Git naming pattern? (e.g., Type.Name, Type.Name_Suffix)

Do we need name transformation? (e.g., remove suffixes, extract parts)

Step 2: Configure vlocity_config.yaml
Use this template for new components:

yaml
# TEMPLATE FOR NEW COMPONENTS
YourNewComponent:
  object: "Salesforce_Object_Name__c"
  fields:
    - "Id"
    - "Name"                    # Or unique identifier field
    - "CreatedDate"
    - "LastModifiedDate"
    # Add other relevant fields
  search_field: "Name"          # Field for SOQL WHERE clause
  compare_field: "Name"         # Field for code comparison
  # Optional: Add filters if needed
  # filter_field: "SomeField__c"
  # filter_value: "filter_value"
  order_by: "LastModifiedDate DESC"
  limit: 100
  strip_type_prefix: true       # Remove "Type." from Git names
  url_decode: false             # Set true if names have %20, %28, etc.
  extract_pattern: "^(.+)$"     # Regex to transform Git names
  # Optional: For complex transformations
  # strip_suffixes: ["_Suffix1", "_Suffix2"]
Step 3: Map in component_types.yaml
yaml
# component_types.yaml
YourNewComponent:
  domain: vlocity              # or salesforce
  kind: bundle                 # or single_file
  folder_roots: ["vlocity/YourNewComponent"]
  primary_glob: "{name}/{name}_DataPack.json"
  # Optional: Add file patterns
  # secondary_globs:
  #   - "{name}/*.json"
  #   - "{name}/**/*.json"
Step 4: Test the Configuration
Create a test script:

python
# test_new_component.py
from vlocity_query_builder import VlocityQueryBuilder

def test_new_component():
    builder = VlocityQueryBuilder()
    
    # Test cases for your new component
    test_cases = [
        "YourNewComponent.SimpleName",
        "YourNewComponent.Name_With_Suffix",
        "YourNewComponent.Complex%20Name%28with%29"
    ]
    
    print("🧪 Testing New Component:")
    print("=" * 80)
    
    for git_name in test_cases:
        try:
            cleaned = builder._clean_component_name(git_name, "YourNewComponent")
            query = builder.build_query_for_component(git_name, "YourNewComponent")
            
            print(f"🔧 YourNewComponent:")
            print(f"   Input:  {git_name}")
            print(f"   Cleaned: {cleaned}")
            print(f"   Query:  {query}")
            print("-" * 80)
            
        except Exception as e:
            print(f"❌ ERROR: {e}")
            print("-" * 80)

if __name__ == "__main__":
    test_new_component()
🎯 Common Patterns Library
Pattern 1: Simple Name (No Transformation)
yaml
SimpleComponent:
  object: "vlocity_cmt__Simple__c"
  fields: ["Id", "Name", "CreatedDate", "LastModifiedDate"]
  search_field: "Name"
  compare_field: "Name"
  strip_type_prefix: true
  url_decode: false
  extract_pattern: "^(.+)$"  # Use name as-is
Pattern 2: Remove Language Suffix
yaml
ComponentWithSuffix:
  object: "vlocity_cmt__WithSuffix__c"
  fields: ["Id", "Name", "CreatedDate", "LastModifiedDate"]
  search_field: "Name"
  compare_field: "Name"
  strip_type_prefix: true
  url_decode: false
  extract_pattern: "^([^_]+)"  # Remove everything after _
  # OR use strip_suffixes:
  strip_suffixes: ["_English", "_Spanish", "_French"]
Pattern 3: Extract Between Parentheses
yaml
ComponentWithCode:
  object: "vlocity_cmt__WithCode__c"
  fields: ["Id", "Name", "CodeField__c", "CreatedDate", "LastModifiedDate"]
  search_field: "CodeField__c"    # Search by code field
  compare_field: "CodeField__c"   # Compare by code field
  strip_type_prefix: true
  url_decode: true
  extract_pattern: ".*\\(([^)]+)"  # Extract text between parentheses
Pattern 4: Use Different Search & Compare Fields
yaml
ComplexComponent:
  object: "vlocity_cmt__Complex__c"
  fields: ["Id", "Name", "UniqueKey__c", "DisplayName", "CreatedDate"]
  search_field: "UniqueKey__c"    # Search by unique key
  compare_field: "UniqueKey__c"   # Compare by unique key
  strip_type_prefix: true
  url_decode: false
  extract_pattern: "^(.+)$"
Pattern 5: With Filter Conditions
yaml
FilteredComponent:
  object: "vlocity_cmt__Filtered__c"
  fields: ["Id", "Name", "Type__c", "CreatedDate", "LastModifiedDate"]
  search_field: "Name"
  compare_field: "Name"
  filter_field: "Type__c"         # Additional filter
  filter_value: "Active"          # Filter value
  order_by: "CreatedDate DESC"
  limit: 100
  strip_type_prefix: true
  url_decode: false
  extract_pattern: "^(.+)$"
🔧 Troubleshooting Guide
Issue: Component not found
bash
# Check if configuration is loaded
DEBUG:vlocity_query_builder:   Config for YourNewComponent: True/False

# Check name transformation
DEBUG:vlocity_query_builder:   Input: YourNewComponent.Name
DEBUG:vlocity_query_builder:   Cleaned: [transformed_name]
DEBUG:vlocity_query_builder:   Query: [generated_query]
Issue: Wrong field comparison
bash
# Check comparison field
DEBUG:deployment_prover:      Compare field: [field_name]
DEBUG:deployment_prover:      [field_name]='[value]' vs cleaned='[cleaned_name]'
Issue: Query fails
python
# Test the query in Salesforce Developer Console
# Copy the generated query and run it manually
📝 Real-World Examples
Example 1: Adding VlocityCard
yaml
VlocityCard:
  object: "vlocity_cmt__VlocityCard__c"
  fields:
    - "Id"
    - "Name"
    - "CreatedDate"
    - "LastModifiedDate"
    - "vlocity_cmt__GlobalKey__c"
  search_field: "Name"
  compare_field: "Name"
  order_by: "LastModifiedDate DESC"
  limit: 100
  strip_type_prefix: true
  url_decode: false
  extract_pattern: "^(.+)$"
Example 2: Adding CalculationMatrix
yaml
CalculationMatrix:
  object: "vlocity_cmt__CalculationMatrix__c"
  fields:
    - "Id"
    - "Name"
    - "CreatedDate"
    - "LastModifiedDate"
    - "vlocity_cmt__VersionNumber__c"
  search_field: "Name"
  compare_field: "Name"
  order_by: "LastModifiedDate DESC"
  limit: 100
  strip_type_prefix: true
  url_decode: false
  extract_pattern: "^(.+)$"
🚀 Quick Start Template
yaml
# QUICK START - Copy and modify
YourComponentName:
  object: "Object_API_Name__c"
  fields:
    - "Id"
    - "Name"                    # Change if different unique field
    - "CreatedDate"
    - "LastModifiedDate"
  search_field: "Name"          # Field to search in SOQL
  compare_field: "Name"         # Field to compare in code
  order_by: "LastModifiedDate DESC"
  limit: 100
  strip_type_prefix: true       # Usually true
  url_decode: false             # Set true if names have % encoding
  extract_pattern: "^(.+)$"     # Change if name transformation needed