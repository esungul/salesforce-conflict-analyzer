# component_config.py
"""
Centralized configuration for all Salesforce component types
Easy to add new components without code changes
"""

def load_additional_config(config_path: str):
    """Load additional component configurations from JSON file"""
    import json
    global COMPONENT_CONFIG
    
    try:
        with open(config_path, 'r') as f:
            additional_config = json.load(f)
        
        COMPONENT_CONFIG.update(additional_config)
        print(f"✅ Loaded {len(additional_config)} additional components from {config_path}")
        return True
        
    except Exception as e:
        print(f"❌ Failed to load additional config: {e}")
        return False

# Load additional components if file exists
import os
if os.path.exists('new_components.json'):
    load_additional_config('new_components.json')
    
COMPONENT_CONFIG = {
    # Vlocity Components
    "DataRaptor": {
        "patterns": [
            r"vlocity/DataRaptor/([^/]+)/([^/]+)_DataPack\.json$",
            r"vlocity/DataRaptor/([^/]+)/([^/]+)_Mappings\.json$",
            r"vlocity/DataRaptor/([^/]+)/([^/]+)_SampleInputJson\.json$"
        ],
        "api_name_extraction": "folder_name",  # Use folder name as API name
        "verification_methods": [
            {"method": "existence", "confidence": "high", "enabled": True},
            {"method": "timestamp", "confidence": "medium", "enabled": True}
        ],
        "deployment_confidence": 0.9,
        "category": "vlocity"
    },
    
    "IntegrationProcedure": {
        "patterns": [
            r"vlocity/IntegrationProcedure/([^/]+)/([^/]+)_DataPack\.json$",
            r"vlocity/IntegrationProcedure/([^/]+)/([^/]+)_Element_[^/]+\.json$",
            r"vlocity/IntegrationProcedure/([^/]+)/([^/]+)_ParentKeys\.json$",
            r"vlocity/IntegrationProcedure/([^/]+)/([^/]+)_PropertySet\.json$"
        ],
        "api_name_extraction": "folder_name",
        "verification_methods": [
            {"method": "existence", "confidence": "high", "enabled": True},
            {"method": "timestamp", "confidence": "medium", "enabled": True}
        ],
        "deployment_confidence": 0.85,
        "category": "vlocity"
    },
    
    "OmniScript": {
        "patterns": [
            r"vlocity/OmniScript/([^/]+)/([^/]+)_DataPack\.json$",
            r"vlocity/OmniScript/([^/]+)/([^/]+)_Element_[^/]+\.json$",
            r"vlocity/OmniScript/([^/]+)/([^/]+)_ParentKeys\.json$"
        ],
        "api_name_extraction": "folder_name", 
        "verification_methods": [
            {"method": "existence", "confidence": "high", "enabled": True},
            {"method": "timestamp", "confidence": "medium", "enabled": True}
        ],
        "deployment_confidence": 0.8,
        "category": "vlocity"
    },
    
    # Standard Salesforce Components
    "ApexClass": {
        "patterns": [
            r".*\/classes\/(.+)\.cls$",
            r".*\/classes\/(.+)\.cls-meta\.xml$"
        ],
        "api_name_extraction": "file_name_no_ext",
        "verification_methods": [
            {"method": "existence", "confidence": "high", "enabled": True},
            {"method": "timestamp", "confidence": "medium", "enabled": True}
        ],
        "deployment_confidence": 0.95,
        "category": "apex"
    },
    
    "ApexTrigger": {
        "patterns": [
            r".*\/triggers\/(.+)\.trigger$",
            r".*\/triggers\/(.+)\.trigger-meta\.xml$"
        ],
        "api_name_extraction": "file_name_no_ext",
        "verification_methods": [
            {"method": "existence", "confidence": "high", "enabled": True},
            {"method": "timestamp", "confidence": "medium", "enabled": True}
        ],
        "deployment_confidence": 0.9,
        "category": "apex"
    },
    
    "Profile": {
        "patterns": [
            r".*\/profiles\/(.+)\.profile-meta\.xml$"
        ],
        "api_name_extraction": "file_name_no_ext",
        "verification_methods": [
            {"method": "existence", "confidence": "high", "enabled": True}
        ],
        "deployment_confidence": 0.7,
        "category": "metadata"
    },
    
    "PermissionSet": {
        "patterns": [
            r".*\/permissionsets\/(.+)\.permissionset-meta\.xml$"
        ],
        "api_name_extraction": "file_name_no_ext",
        "verification_methods": [
            {"method": "existence", "confidence": "high", "enabled": True}
        ],
        "deployment_confidence": 0.8,
        "category": "metadata"
    },
    
    "CustomObject": {
        "patterns": [
            r".*\/objects\/(.+)\.object-meta\.xml$"
        ],
        "api_name_extraction": "file_name_no_ext",
        "verification_methods": [
            {"method": "existence", "confidence": "high", "enabled": True}
        ],
        "deployment_confidence": 0.9,
        "category": "metadata"
    },
    
    "CustomField": {
        "patterns": [
            r".*\/objects\/([^/]+)\/fields\/(.+)\.field-meta\.xml$"
        ],
        "api_name_extraction": "object_field_combination",
        "verification_methods": [
            {"method": "existence", "confidence": "high", "enabled": True}
        ],
        "deployment_confidence": 0.85,
        "category": "metadata"
    },
    
    "Layout": {
        "patterns": [
            r".*\/layouts\/(.+)\.layout-meta\.xml$"
        ],
        "api_name_extraction": "file_name_no_ext", 
        "verification_methods": [
            {"method": "existence", "confidence": "medium", "enabled": True}
        ],
        "deployment_confidence": 0.75,
        "category": "metadata"
    },
    
    "Flow": {
        "patterns": [
            r".*\/flows\/(.+)\.flow-meta\.xml$"
        ],
        "api_name_extraction": "file_name_no_ext",
        "verification_methods": [
            {"method": "existence", "confidence": "medium", "enabled": True}
        ],
        "deployment_confidence": 0.8,
        "category": "automation"
    }
}

# Template for adding new components
COMPONENT_TEMPLATE = {
    "patterns": [
        # Add regex patterns that match your component's file paths
    ],
    "api_name_extraction": "folder_name|file_name_no_ext|object_field_combination|custom",
    "verification_methods": [
        {"method": "existence", "confidence": "high|medium|low", "enabled": True}
    ],
    "deployment_confidence": 0.0,  # 0.0 to 1.0
    "category": "your_category"  # vlocity, apex, metadata, automation, etc.
}