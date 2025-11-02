# 🎯 QUICK REFERENCE: Component Query Configuration

## 📊 **COMPLETE COMPONENT TABLE**

| Component Type | Config File | API | Object | Name Field | Notes |
|----------------|-------------|-----|--------|------------|-------|
| **APEX** |
| ApexClass | validation_config.py | soql | ApexClass | Name | Can also use tooling |
| ApexTrigger | validation_config.py | soql | ApexTrigger | Name | Can also use tooling |
| ApexPage | validation_config.py | soql | ApexPage | Name | VisualForce pages |
| ApexComponent | validation_config.py | soql | ApexComponent | Name | VisualForce components |
| **LIGHTNING** |
| LightningComponentBundle | validation_config.py | **tooling** | LightningComponentBundle | **DeveloperName** | LWC - MUST use tooling |
| AuraDefinitionBundle | validation_config.py | tooling | AuraDefinitionBundle | DeveloperName | Aura components |
| **AUTOMATION** |
| Flow | validation_config.py | soql | Flow | **DeveloperName** | Flows & Process Builder |
| WorkflowRule | validation_config.py | tooling | WorkflowRule | Name | Legacy workflow |
| **SECURITY** |
| PermissionSet | validation_config.py | soql | PermissionSet | Name | Permission sets |
| Profile | validation_config.py | soql | Profile | Name | Often read-only |
| **CUSTOM METADATA** |
| CustomObject | validation_config.py | tooling | CustomObject | DeveloperName | Custom objects |
| CustomField | validation_config.py | tooling | CustomField | DeveloperName | Custom fields |
| ValidationRule | validation_config.py | tooling | ValidationRule | ValidationName | Validation rules |
| **VLOCITY/OMNISTUDIO** |
| OmniScript | vlocity_config.yaml | vlocity | vlocity_cmt__OmniScript__c | Name | Strip language suffix |
| IntegrationProcedure | vlocity_config.yaml | vlocity | vlocity_cmt__OmniScript__c | vlocity_cmt__ProcedureKey__c | Same object as OmniScript! |
| DataRaptor | vlocity_config.yaml | vlocity | vlocity_cmt__DRBundle__c | vlocity_cmt__DRMapName__c | Extract/Transform/Load |
| VlocityCard | vlocity_config.yaml | vlocity | vlocity_cmt__VlocityCard__c | Name | Layout cards |
| VlocityUITemplate | vlocity_config.yaml | vlocity | vlocity_cmt__VlocityUITemplate__c | Name | UI templates |

---

## 🔑 **KEY PATTERNS**

### **Name Field Decision Tree**
```
Does it have a namespace prefix? (e.g., DeveloperName, ProcedureKey__c)
├─ YES → Use that field
└─ NO → Use "Name"

Examples:
✅ LightningComponentBundle → DeveloperName
✅ Flow → DeveloperName  
✅ IntegrationProcedure → vlocity_cmt__ProcedureKey__c
✅ ApexClass → Name
```

### **API Type Decision Tree**
```
Is it a Lightning Web Component?
├─ YES → MUST use tooling
└─ NO → Is it custom metadata (CustomObject/Field/ValidationRule)?
        ├─ YES → Use tooling
        └─ NO → Is it Vlocity/OmniStudio?
                ├─ YES → Use vlocity
                └─ NO → Use soql
```

---

## 📝 **EXAMPLE CONFIGURATIONS**

### **Example 1: ApexClass (Standard SOQL)**
```python
# In validation_config.py
'ApexClass': {
    'api': 'soql',
    'object': 'ApexClass',
    'name_field': 'Name',
    'date_field': 'LastModifiedDate',
    'enabled': True,
    'vendor': 'salesforce'
}
```

**Query Generated:**
```sql
SELECT Id, Name, LastModifiedDate, CreatedDate
FROM ApexClass
WHERE Name = 'PR_StockReservation'
LIMIT 1
```

---

### **Example 2: LightningComponentBundle (Tooling API)**
```python
# In validation_config.py
'LightningComponentBundle': {
    'api': 'tooling',  # MUST use tooling!
    'object': 'LightningComponentBundle',
    'name_field': 'DeveloperName',  # Note: DeveloperName!
    'date_field': 'LastModifiedDate',
    'enabled': True,
    'vendor': 'salesforce'
}
```

**Query Generated (Tooling API):**
```sql
SELECT Id, DeveloperName, NamespacePrefix, CreatedDate, LastModifiedDate
FROM LightningComponentBundle
WHERE DeveloperName = 'prDisplaySelectDigital'
LIMIT 1
```

---

### **Example 3: OmniScript (Vlocity)**
```yaml
# In vlocity_config.yaml
OmniScript:
  object: "vlocity_cmt__OmniScript__c"
  fields:
    - "Name"
    - "CreatedDate"
    - "LastModifiedDate"
    - "vlocity_cmt__Type__c"
    - "vlocity_cmt__OmniProcessType__c"
  filter_field: "vlocity_cmt__OmniProcessType__c"
  filter_value: "OmniScript"
  search_field: "Name"
  strip_suffixes:
    - "_English"
    - "_Spanish"
  order_by: "CreatedDate DESC"
  limit: 100
```

**Query Generated:**
```sql
SELECT Name, CreatedDate, LastModifiedDate, vlocity_cmt__Type__c, 
       vlocity_cmt__OmniProcessType__c
FROM vlocity_cmt__OmniScript__c
WHERE vlocity_cmt__OmniProcessType__c = 'OmniScript'
  AND Name = 'PR_MultiLineorderMobileDigital'  -- (stripped _English)
ORDER BY CreatedDate DESC
LIMIT 100
```

---

### **Example 4: IntegrationProcedure (Vlocity)**
```yaml
# In vlocity_config.yaml
IntegrationProcedure:
  object: "vlocity_cmt__OmniScript__c"  # Same as OmniScript!
  fields:
    - "Name"
    - "vlocity_cmt__ProcedureKey__c"
    - "vlocity_cmt__IsProcedure__c"
    - "LastModifiedDate"
  filter_field: "vlocity_cmt__IsProcedure__c"
  filter_value: "true"
  search_field: "vlocity_cmt__ProcedureKey__c"  # Use ProcedureKey!
  order_by: "CreatedDate DESC"
  limit: 100
```

**Query Generated:**
```sql
SELECT Name, vlocity_cmt__ProcedureKey__c, vlocity_cmt__IsProcedure__c, 
       LastModifiedDate
FROM vlocity_cmt__OmniScript__c
WHERE vlocity_cmt__IsProcedure__c = true
  AND vlocity_cmt__ProcedureKey__c = 'PR_UpdateReservationIdDigital'
ORDER BY CreatedDate DESC
LIMIT 100
```

---

## 🎓 **HOW TO DETERMINE CONFIG FOR NEW COMPONENT**

### **Step 1: Test Query in Salesforce**

**For Standard Components:**
```sql
-- Try in Developer Console (Query Editor)
SELECT Id, Name, DeveloperName, LastModifiedDate
FROM YourComponentType
LIMIT 1
```

If it works → Use `api: 'soql'`

If it fails → Try Tooling API in Workbench

**For Tooling API:**
```
1. Go to Workbench (workbench.developerforce.com)
2. Login to your org
3. Queries → Query → Select "Tooling API"
4. Test: SELECT Id, DeveloperName FROM YourComponentType LIMIT 1
```

If it works → Use `api: 'tooling'`

---

### **Step 2: Identify Name Field**

Run this query to see available fields:
```sql
-- SOQL
SELECT * FROM YourComponentType LIMIT 1

-- Tooling API
SELECT * FROM YourComponentType LIMIT 1
```

Look for:
- `Name` - Most common
- `DeveloperName` - For LWC, Flows, CustomObjects
- Custom fields like `vlocity_cmt__ProcedureKey__c`

---

### **Step 3: Add to Config**

**If Salesforce Standard:**
```python
# validation_config.py
'YourComponentType': {
    'api': 'soql',  # or 'tooling'
    'object': 'YourComponentType',
    'name_field': 'Name',  # or 'DeveloperName'
    'date_field': 'LastModifiedDate',
    'enabled': True,
    'vendor': 'salesforce'
}
```

**If Vlocity:**
```yaml
# vlocity_config.yaml
YourVlocityType:
  object: "vlocity_cmt__YourObject__c"
  fields:
    - "Name"
    - "CreatedDate"
    - "LastModifiedDate"
  search_field: "Name"
  order_by: "CreatedDate DESC"
  limit: 100
```

---

## 🚨 **COMMON MISTAKES TO AVOID**

| Mistake | Correct Approach |
|---------|------------------|
| ❌ Using `Name` for LWC | ✅ Use `DeveloperName` |
| ❌ Using SOQL for LWC | ✅ Must use Tooling API |
| ❌ Using `Name` for IntegrationProcedure | ✅ Use `vlocity_cmt__ProcedureKey__c` |
| ❌ Querying IntegrationProcedure without filter | ✅ Add `vlocity_cmt__IsProcedure__c = true` |
| ❌ Not stripping language suffix for OmniScript | ✅ Configure `strip_suffixes` |
| ❌ Hardcoding component types in code | ✅ Add to config files |

---

## 📚 **SUMMARY**

### **Configuration Philosophy**

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  ALL QUERIES SHOULD BE CONFIGURATION-DRIVEN            │
│                                                         │
│  1. Define in config files (not hardcoded)             │
│  2. Use proper API (soql/tooling/vlocity)              │
│  3. Specify correct name field                         │
│  4. Test queries in Salesforce first                   │
│  5. Enable/disable as needed                           │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### **File Organization**

```
backend/
├── validation_config.py      ← Salesforce standard components
│   └── COMPONENT_QUERY_CONFIG dict
│
├── vlocity_config.yaml        ← Vlocity/OmniStudio components
│   └── components section
│
├── vlocity_query_builder.py  ← Reads vlocity_config.yaml
│
└── deployment_prover.py       ← Uses both configs
    └── _fetch_all_production_components()
```

---

## ✅ **VERIFICATION CHECKLIST**

After adding a new component:

- [ ] Query tested in Salesforce (Developer Console or Workbench)
- [ ] Correct API type identified (soql/tooling/vlocity)
- [ ] Correct name field identified (Name/DeveloperName/custom)
- [ ] Configuration added to proper file
- [ ] Flask restarted
- [ ] Test with actual user story
- [ ] Logs show "✓ Found: ComponentName"
- [ ] Timestamps validate correctly

---

**Need help?** Check the full guide: [CONFIGURATION_GUIDE.md](computer:///mnt/user-data/outputs/CONFIGURATION_GUIDE.md)
