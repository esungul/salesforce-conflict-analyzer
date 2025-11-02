# 🎯 CONFIGURATION GUIDE: Component Queries
# ==========================================

## 📋 **WHERE TO DEFINE WHAT**

### **1. validation_config.py** - For Salesforce Standard & Tooling API Components
   - Location: `/backend/validation_config.py`
   - Purpose: Define queries for standard Salesforce metadata
   - Use for: ApexClass, LWC, Flows, PermissionSets, etc.

### **2. vlocity_config.yaml** - For Vlocity/OmniStudio Components
   - Location: `/backend/vlocity_config.yaml`
   - Purpose: Define queries for Vlocity/OmniStudio components
   - Use for: OmniScript, IntegrationProcedure, DataRaptor, etc.


## 🔍 **DECISION TREE: Which Config File?**

```
Is the component a Vlocity/OmniStudio component?
│
├─ YES → Use vlocity_config.yaml
│         Examples: OmniScript, IntegrationProcedure, DataRaptor
│
└─ NO → Use validation_config.py
          │
          ├─ Can it be queried via standard SOQL? → api: 'soql'
          │   Examples: ApexClass, ApexTrigger, PermissionSet
          │
          └─ Requires Tooling API? → api: 'tooling'
              Examples: LightningComponentBundle, ValidationRule
```


## 📊 **COMPLETE COMPONENT REFERENCE**

### **APEX COMPONENTS**

| Component Type | API | Object | Name Field | Config File |
|----------------|-----|--------|------------|-------------|
| ApexClass | soql or tooling | ApexClass | Name | validation_config.py |
| ApexTrigger | soql or tooling | ApexTrigger | Name | validation_config.py |
| ApexPage | soql | ApexPage | Name | validation_config.py |
| ApexComponent | soql | ApexComponent | Name | validation_config.py |

**Example Query:**
```sql
SELECT Id, Name, LastModifiedDate, CreatedDate
FROM ApexClass
WHERE Name = 'MyClassName'
```


### **LIGHTNING COMPONENTS**

| Component Type | API | Object | Name Field | Config File |
|----------------|-----|--------|------------|-------------|
| LightningComponentBundle | **tooling** | LightningComponentBundle | DeveloperName | validation_config.py |
| AuraDefinitionBundle | tooling | AuraDefinitionBundle | DeveloperName | validation_config.py |

**Example Query (Tooling API):**
```sql
SELECT Id, DeveloperName, NamespacePrefix, LastModifiedDate
FROM LightningComponentBundle
WHERE DeveloperName = 'myLwcComponent'
```


### **AUTOMATION**

| Component Type | API | Object | Name Field | Config File |
|----------------|-----|--------|------------|-------------|
| Flow | soql | Flow | DeveloperName | validation_config.py |
| WorkflowRule | tooling | WorkflowRule | Name | validation_config.py |
| ApexTrigger | soql | ApexTrigger | Name | validation_config.py |

**Example Query:**
```sql
SELECT Id, DeveloperName, ProcessType, LastModifiedDate
FROM Flow
WHERE DeveloperName = 'My_Flow'
```


### **SECURITY**

| Component Type | API | Object | Name Field | Config File |
|----------------|-----|--------|------------|-------------|
| PermissionSet | soql | PermissionSet | Name | validation_config.py |
| Profile | soql | Profile | Name | validation_config.py |

**Example Query:**
```sql
SELECT Id, Name, Label, LastModifiedDate
FROM PermissionSet
WHERE Name = 'My_Permission_Set'
```


### **CUSTOM OBJECTS & FIELDS**

| Component Type | API | Object | Name Field | Config File |
|----------------|-----|--------|------------|-------------|
| CustomObject | tooling | CustomObject | DeveloperName | validation_config.py |
| CustomField | tooling | CustomField | DeveloperName | validation_config.py |
| ValidationRule | tooling | ValidationRule | ValidationName | validation_config.py |

**Example Query (Tooling API):**
```sql
SELECT Id, DeveloperName, LastModifiedDate
FROM CustomObject
WHERE DeveloperName = 'My_Custom_Object'
```


### **VLOCITY/OMNISTUDIO**

| Component Type | API | Object | Name Field | Config File |
|----------------|-----|--------|------------|-------------|
| OmniScript | vlocity | vlocity_cmt__OmniScript__c | Name | vlocity_config.yaml |
| IntegrationProcedure | vlocity | vlocity_cmt__OmniScript__c | vlocity_cmt__ProcedureKey__c | vlocity_config.yaml |
| DataRaptor | vlocity | vlocity_cmt__DRBundle__c | vlocity_cmt__DRMapName__c | vlocity_config.yaml |

**Example Query (SOQL with special handling):**
```sql
-- OmniScript
SELECT Id, Name, vlocity_cmt__Type__c, LastModifiedDate
FROM vlocity_cmt__OmniScript__c
WHERE vlocity_cmt__OmniProcessType__c = 'OmniScript'
  AND Name = 'My_OmniScript'

-- IntegrationProcedure
SELECT Id, vlocity_cmt__ProcedureKey__c, LastModifiedDate
FROM vlocity_cmt__OmniScript__c
WHERE vlocity_cmt__IsProcedure__c = true
  AND vlocity_cmt__ProcedureKey__c = 'My_IP'
```


## ⚙️ **CONFIGURATION FILE TEMPLATES**

### **Template 1: validation_config.py**

```python
"""
Salesforce Component Query Configuration
=========================================

Defines how to query different Salesforce metadata types.
"""

# Flag to check if config is available
VALIDATION_CONFIG_AVAILABLE = True

COMPONENT_QUERY_CONFIG = {
    
    # ========================================================================
    # APEX COMPONENTS
    # ========================================================================
    
    'ApexClass': {
        'api': 'soql',                    # or 'tooling'
        'object': 'ApexClass',            # Salesforce object name
        'name_field': 'Name',             # Field to match component name
        'date_field': 'LastModifiedDate', # Field for timestamp comparison
        'enabled': True,                  # Set False to skip
        'vendor': 'salesforce',           # 'salesforce' or 'vlocity'
        'description': 'Apex Classes'
    },
    
    'ApexTrigger': {
        'api': 'soql',
        'object': 'ApexTrigger',
        'name_field': 'Name',
        'date_field': 'LastModifiedDate',
        'enabled': True,
        'vendor': 'salesforce',
        'description': 'Apex Triggers'
    },
    
    # ========================================================================
    # LIGHTNING COMPONENTS
    # ========================================================================
    
    'LightningComponentBundle': {
        'api': 'tooling',                 # MUST use tooling!
        'object': 'LightningComponentBundle',
        'name_field': 'DeveloperName',    # Note: DeveloperName, not Name!
        'date_field': 'LastModifiedDate',
        'enabled': True,
        'vendor': 'salesforce',
        'description': 'Lightning Web Components',
        'requires_access': 'tooling_api'
    },
    
    'AuraDefinitionBundle': {
        'api': 'tooling',
        'object': 'AuraDefinitionBundle',
        'name_field': 'DeveloperName',
        'date_field': 'LastModifiedDate',
        'enabled': True,
        'vendor': 'salesforce',
        'description': 'Aura Components'
    },
    
    # ========================================================================
    # AUTOMATION
    # ========================================================================
    
    'Flow': {
        'api': 'soql',
        'object': 'Flow',
        'name_field': 'DeveloperName',    # Note: DeveloperName!
        'date_field': 'LastModifiedDate',
        'enabled': True,
        'vendor': 'salesforce',
        'description': 'Flows'
    },
    
    # ========================================================================
    # SECURITY
    # ========================================================================
    
    'PermissionSet': {
        'api': 'soql',
        'object': 'PermissionSet',
        'name_field': 'Name',
        'date_field': 'LastModifiedDate',
        'enabled': True,
        'vendor': 'salesforce',
        'description': 'Permission Sets'
    },
    
    'Profile': {
        'api': 'soql',
        'object': 'Profile',
        'name_field': 'Name',
        'date_field': 'LastModifiedDate',
        'enabled': False,  # Often read-only in production
        'vendor': 'salesforce',
        'description': 'Profiles'
    },
    
    # ========================================================================
    # CUSTOM METADATA
    # ========================================================================
    
    'CustomObject': {
        'api': 'tooling',
        'object': 'CustomObject',
        'name_field': 'DeveloperName',
        'date_field': 'LastModifiedDate',
        'enabled': True,
        'vendor': 'salesforce',
        'description': 'Custom Objects'
    },
    
    'CustomField': {
        'api': 'tooling',
        'object': 'CustomField',
        'name_field': 'DeveloperName',
        'date_field': 'LastModifiedDate',
        'enabled': True,
        'vendor': 'salesforce',
        'description': 'Custom Fields'
    },
    
    'ValidationRule': {
        'api': 'tooling',
        'object': 'ValidationRule',
        'name_field': 'ValidationName',
        'date_field': 'LastModifiedDate',
        'enabled': True,
        'vendor': 'salesforce',
        'description': 'Validation Rules'
    },
    
    # Add more as needed...
}


def get_component_query_config(component_type: str) -> dict:
    """
    Get query configuration for a component type
    
    Args:
        component_type: Type of component (e.g., 'ApexClass', 'LightningComponentBundle')
    
    Returns:
        Configuration dict or None if not found
    """
    return COMPONENT_QUERY_CONFIG.get(component_type)


def is_vlocity_component(component_type: str) -> bool:
    """Check if component is a Vlocity component"""
    config = get_component_query_config(component_type)
    return config.get('vendor') == 'vlocity' if config else False


def get_all_enabled_types() -> list:
    """Get list of all enabled component types"""
    return [
        comp_type 
        for comp_type, config in COMPONENT_QUERY_CONFIG.items() 
        if config.get('enabled', True)
    ]
```


### **Template 2: vlocity_config.yaml**

```yaml
# Vlocity/OmniStudio Component Configuration
# ===========================================

# Namespace prefix (vlocity_cmt for most orgs)
namespace: "vlocity_cmt"

# List of component types that are Vlocity
vlocity_types:
  - OmniScript
  - IntegrationProcedure
  - DataRaptor
  - VlocityCard
  - VlocityUITemplate

# Component-specific configurations
components:
  
  # ==========================================================================
  # OMNISCRIPT
  # ==========================================================================
  OmniScript:
    object: "vlocity_cmt__OmniScript__c"
    
    fields:
      - "Name"
      - "CreatedDate"
      - "LastModifiedDate"
      - "vlocity_cmt__Type__c"
      - "vlocity_cmt__SubType__c"
      - "vlocity_cmt__Version__c"
      - "vlocity_cmt__OmniProcessType__c"
    
    # Filter to distinguish from IntegrationProcedure
    filter_field: "vlocity_cmt__OmniProcessType__c"
    filter_value: "OmniScript"
    
    # Search field
    search_field: "Name"
    
    # Language suffixes to remove (_English, _Spanish, etc.)
    strip_suffixes:
      - "_English"
      - "_Spanish"
      - "_French"
      - "_German"
    
    order_by: "CreatedDate DESC"
    limit: 100
  
  # ==========================================================================
  # INTEGRATION PROCEDURE
  # ==========================================================================
  IntegrationProcedure:
    object: "vlocity_cmt__OmniScript__c"  # Same object as OmniScript!
    
    fields:
      - "Name"
      - "CreatedDate"
      - "LastModifiedDate"
      - "vlocity_cmt__ProcedureKey__c"
      - "vlocity_cmt__IsProcedure__c"
    
    # Filter to distinguish from OmniScript
    filter_field: "vlocity_cmt__IsProcedure__c"
    filter_value: "true"
    
    # Search field (use ProcedureKey, not Name!)
    search_field: "vlocity_cmt__ProcedureKey__c"
    
    order_by: "CreatedDate DESC"
    limit: 100
  
  # ==========================================================================
  # DATARAPTOR
  # ==========================================================================
  DataRaptor:
    object: "vlocity_cmt__DRBundle__c"
    
    fields:
      - "Id"
      - "Name"
      - "vlocity_cmt__DRMapName__c"
      - "CreatedDate"
      - "LastModifiedDate"
      - "vlocity_cmt__Description__c"
    
    # Search field (use DRMapName, not Name!)
    search_field: "vlocity_cmt__DRMapName__c"
    
    order_by: "CreatedDate DESC"
    limit: 100

# Global settings
settings:
  # Remove type prefix from component names
  strip_type_prefix: true
  
  # Handle doubled prefixes (OmniScript.OmniScript.Name)
  fix_doubled_prefix: true
```


## 🎯 **HOW TO ADD A NEW COMPONENT TYPE**

### **For Salesforce Standard Components:**

1. **Determine the API type** (SOQL or Tooling)
   ```bash
   # Test in Salesforce Developer Console:
   # SOQL:
   SELECT Id, Name FROM ApexClass LIMIT 1
   
   # Tooling:
   # Use Workbench > Queries > Tooling API
   SELECT Id, DeveloperName FROM LightningComponentBundle LIMIT 1
   ```

2. **Add to `validation_config.py`:**
   ```python
   'MyNewType': {
       'api': 'soql',  # or 'tooling'
       'object': 'MyObject',
       'name_field': 'Name',  # or 'DeveloperName'
       'date_field': 'LastModifiedDate',
       'enabled': True,
       'vendor': 'salesforce',
       'description': 'My New Type'
   }
   ```

3. **Test:**
   ```bash
   # Restart Flask
   python app.py
   
   # Test with a story that has this component
   curl -X POST http://localhost:5000/api/deployment/prove/story \
     -d '{"story_name": "US-XXXXX", "target_env": "production"}'
   ```


### **For Vlocity Components:**

1. **Identify the Salesforce object:**
   - Check in your Salesforce org
   - Look for objects with `vlocity_cmt__` prefix

2. **Determine the search field:**
   - Name
   - vlocity_cmt__ProcedureKey__c
   - vlocity_cmt__DRMapName__c
   - etc.

3. **Add to `vlocity_config.yaml`:**
   ```yaml
   MyVlocityType:
     object: "vlocity_cmt__MyObject__c"
     fields:
       - "Name"
       - "CreatedDate"
       - "LastModifiedDate"
     search_field: "Name"
     order_by: "CreatedDate DESC"
     limit: 100
   ```

4. **Add to vlocity_types list:**
   ```yaml
   vlocity_types:
     - OmniScript
     - IntegrationProcedure
     - DataRaptor
     - MyVlocityType  # ← Add here
   ```


## 📖 **QUICK REFERENCE CARD**

```
┌─────────────────────────────────────────────────────────────┐
│                   CONFIGURATION CHEAT SHEET                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  QUESTION: Which config file should I use?                 │
│                                                             │
│  ┌─────────────────────────────────────────────────┐      │
│  │ Is it a Vlocity/OmniStudio component?            │      │
│  │                                                   │      │
│  │ YES → vlocity_config.yaml                        │      │
│  │ NO  → validation_config.py                       │      │
│  └─────────────────────────────────────────────────┘      │
│                                                             │
│  ┌─────────────────────────────────────────────────┐      │
│  │ Which API should I use?                          │      │
│  │                                                   │      │
│  │ • LightningComponentBundle → tooling             │      │
│  │ • CustomObject/Field       → tooling             │      │
│  │ • ValidationRule           → tooling             │      │
│  │ • ApexClass                → soql or tooling     │      │
│  │ • Flow                     → soql                │      │
│  │ • PermissionSet            → soql                │      │
│  │ • Vlocity components       → vlocity             │      │
│  └─────────────────────────────────────────────────┘      │
│                                                             │
│  ┌─────────────────────────────────────────────────┐      │
│  │ Which name field?                                │      │
│  │                                                   │      │
│  │ • Most standard objects    → Name                │      │
│  │ • LWC, Flow, CustomObject  → DeveloperName       │      │
│  │ • IntegrationProcedure     → ProcedureKey__c     │      │
│  │ • DataRaptor               → DRMapName__c        │      │
│  └─────────────────────────────────────────────────┘      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```


## 🚀 **TESTING CHECKLIST**

After adding a new component type:

- [ ] Configuration added to correct file
- [ ] API type specified correctly (soql/tooling/vlocity)
- [ ] Name field is correct
- [ ] Tested with Developer Console / Workbench
- [ ] Flask restarted
- [ ] Test story runs successfully
- [ ] Component shows as "Found" in logs
- [ ] Timestamps validate correctly


## 💡 **TIPS & BEST PRACTICES**

1. **Always test queries in Salesforce first**
   - Use Developer Console for SOQL
   - Use Workbench for Tooling API

2. **Check field names carefully**
   - Some use `Name`, others use `DeveloperName`
   - Vlocity fields have custom prefixes

3. **Enable/disable as needed**
   - Set `enabled: False` for types you can't query in production

4. **Document your changes**
   - Add `description` field
   - Comment why a particular API is used

5. **Keep configs in version control**
   - validation_config.py → Git
   - vlocity_config.yaml → Git
