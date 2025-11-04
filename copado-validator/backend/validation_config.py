"""
Salesforce Component Query Configuration
=========================================

This file defines how to query different Salesforce metadata types.
Used by deployment_prover.py to fetch production component state.

IMPORTANT: Add new component types here - don't hardcode in the main code!
"""

from typing import List,Dict

# Flag to check if config is available
VALIDATION_CONFIG_AVAILABLE = True

import logging


log = logging.getLogger(__name__)


VALIDATION_CONFIG = {
    'validators': {
        'commit_exists': {
            'enabled': True,
            'description': 'Verify commit exists in Git',
            'type': 'git',
            'requires_access': 'git',
            'failure_mode': 'critical',
            'execution_order': 1
        },
        
        'commit_contents': {
                    'enabled': True,
                    'description': 'Show files and actual content changes in Git commit',
                    'type': 'informational',
                    'requires_access': 'git',
                    'failure_mode': 'warning',
                    'execution_order': 15,
                    'options': {
                        'show_diffs': True,           # Show actual diff content
                        'max_diff_lines': 20,         # Max lines to show per file (0 = no limit)
                        'context_lines': 3,           # Lines of context around changes
                        'exclude_patterns': [          # File patterns to exclude from diffs
                            '*.xml',                   # Often too verbose
                            '*.json',                  # Can be large
                            'package.json',
                            'package-lock.json'
                        ]
                    }
                },
        
        'files_in_commit': {
            'enabled': True,
            'description': 'Verify files changed in commit',
            'type': 'git',
            'requires_access': 'git',
            'failure_mode': 'warning',
            'execution_order': 3
        },
        'component_exists': {
            'enabled': True,
            'description': 'Verify component exists in Salesforce',
            'type': 'salesforce',
            'requires_access': 'salesforce',
            'failure_mode': 'critical',
            'execution_order': 10
        },
        'component_timestamp': {
            'enabled': True,
            'description': 'Compare Salesforce modified date vs commit date',
            'type': 'comparison',
            'requires_access': 'salesforce,git',
            'failure_mode': 'warning',
            'execution_order': 11
        },
        'metadata_content_match': {
            'enabled': False,  # Enable if you have Tooling API access
            'description': 'Compare Git vs Salesforce content',
            'type': 'comparison',
            'requires_access': 'salesforce,git,metadata_api',
            'failure_mode': 'warning',
            'execution_order': 12
        },
        'copado_deployment_record': {
            'enabled': True,
            'description': 'Check Copado deployment record',
            'type': 'copado',
            'requires_access': 'salesforce',
            'failure_mode': 'warning',
            'execution_order': 20
        },
        'file_mapping': {
            'enabled': False,
            'description': 'Verify component type file mapping',
            'type': 'configuration',
            'requires_access': 'none',
            'failure_mode': 'warning',
            'execution_order': 40
        },
        'file_size_check': {
            'enabled': True,
            'description': 'Verify files within size limits',
            'type': 'git',
            'requires_access': 'git',
            'failure_mode': 'warning',
            'execution_order': 41
        }
    },
    
    'levels': {
        'basic': {
            'description': 'Quick check - component exists',
            'validators': ['component_exists']
        },
        'standard': {
            'description': 'Standard validation',
            'validators': [
                'commit_exists',
                'component_exists',
                'component_timestamp',
                'commit_contents'
            ]
        },
        'high': {
            'description': 'High validation with deployment records',
            'validators': [
                'commit_exists',
                'files_in_commit',
                'component_exists',
                'component_timestamp',
                'commit_contents'
            ]
        },
        'maximum': {
            'description': 'Maximum validation - all checks',
            'validators': [
                'commit_exists',
                'files_in_commit',
                'component_exists',
                'component_timestamp',
                'metadata_content_match',
                'commit_contents',
                'file_size_check'
            ]
        }
    },
    
    # 🔧 UPDATE THESE BASED ON YOUR ENVIRONMENT
   'access_permissions': {
        'git': True,
        'salesforce': True,
        'metadata_api': True,  # Set True if you have Tooling/Metadata API
        'copado': True
    }
}



COMPONENT_QUERY_CONFIG = {
    
    # ========================================================================
    # APEX COMPONENTS
    # ========================================================================
    
    
    'RecordType': {
    'api': 'soql',
    'object': 'RecordType', 
    'name_field': 'DeveloperName',
    'date_field': 'LastModifiedDate',
    'enabled': True,
    'vendor': 'salesforce',
    'description': 'Record Types'
},
    
    'CustomField': {
        'api': 'tooling',
        'object': 'CustomField',
        'name_field': 'DeveloperName',
        'date_field': 'LastModifiedDate',
        'enabled': True,
        'vendor': 'salesforce',  # Back to salesforce
        'description': 'Custom Fields'
},
    'CustomObject': {
        'api': 'tooling',
        'object': 'CustomObject',
        'name_field': 'DeveloperName',
        'date_field': 'LastModifiedDate',
        'enabled': True,
        'vendor': 'salesforce',
        'description': 'Custom Objects',
        'name_cleaning': {
            'strip_type_prefix': True,
            'keep_namespace': True        # Keep namespace if present
        }
    },
    'ApexClass': {
        'api': 'soql',                    # Can also use 'tooling'
        'object': 'ApexClass',
        'name_field': 'Name',
        'date_field': 'LastModifiedDate',
        'enabled': True,
        'vendor': 'salesforce',
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
    
    'ApexPage': {
        'api': 'soql',
        'object': 'ApexPage',
        'name_field': 'Name',
        'date_field': 'LastModifiedDate',
        'enabled': True,
        'vendor': 'salesforce',
        'description': 'Visualforce Pages'
    },
    
    'ApexComponent': {
        'api': 'soql',
        'object': 'ApexComponent',
        'name_field': 'Name',
        'date_field': 'LastModifiedDate',
        'enabled': True,
        'vendor': 'salesforce',
        'description': 'Visualforce Components'
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
        'description': 'Lightning Web Components (LWC)',
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
        'api': 'tooling',
        'object': 'Flow',
        'name_field': 'DeveloperName',    # Note: DeveloperName!
        'date_field': 'LastModifiedDate',
        'enabled': True,
        'vendor': 'salesforce',
        'description': 'Flows and Process Builder'
    },
    
    'WorkflowRule': {
        'api': 'tooling',
        'object': 'WorkflowRule',
        'name_field': 'Name',
        'date_field': 'LastModifiedDate',
        'enabled': False,  # Often not queryable in production
        'vendor': 'salesforce',
        'description': 'Workflow Rules (Legacy)'
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
    
    'PermissionSetGroup': {
        'api': 'soql',
        'object': 'PermissionSetGroup',
        'name_field': 'DeveloperName',
        'date_field': 'LastModifiedDate',
        'enabled': True,
        'vendor': 'salesforce',
        'description': 'Permission Set Groups'
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
    
    'CustomMetadata': {
        'api': 'soql',
        'object': 'CustomMetadata',
        'name_field': 'DeveloperName',
        'date_field': 'LastModifiedDate',
        'enabled': True,
        'vendor': 'salesforce',
        'description': 'Custom Metadata Types'
    },
    
    # ========================================================================
    # LAYOUT & UI
    # ========================================================================
    
    'Layout': {
        'api': 'tooling',
        'object': 'Layout',
        'name_field': 'Name',
        'date_field': 'LastModifiedDate',
        'enabled': True,
        'vendor': 'salesforce',
        'description': 'Page Layouts'
    },
    
    # ========================================================================
    # EMAIL & MESSAGING
    # ========================================================================
    
    'EmailTemplate': {
        'api': 'soql',
        'object': 'EmailTemplate',
        'name_field': 'DeveloperName',
        'date_field': 'LastModifiedDate',
        'enabled': True,
        'vendor': 'salesforce',
        'description': 'Email Templates'
    },
    
    # ========================================================================
    # STATIC RESOURCES
    # ========================================================================
    
    'StaticResource': {
        'api': 'soql',
        'object': 'StaticResource',
        'name_field': 'Name',
        'date_field': 'LastModifiedDate',
        'enabled': True,
        'vendor': 'salesforce',
        'description': 'Static Resources'
    },
    
    # ========================================================================
    # VLOCITY/OMNISTUDIO (Marker entries - actual queries in vlocity_config.yaml)
    # ========================================================================
    
    'OmniScript': {
        'api': 'vlocity',
        'object': 'vlocity_cmt__OmniScript__c',
        'name_field': 'Name',
        'date_field': 'LastModifiedDate',
        'enabled': True,
        'vendor': 'vlocity',
        'description': 'OmniScript - Use vlocity_config.yaml for queries'
    },
       
    
    'IntegrationProcedure': {
        'api': 'vlocity',
        'object': 'vlocity_cmt__OmniScript__c',
        'name_field': 'vlocity_cmt__ProcedureKey__c',
        'date_field': 'LastModifiedDate',
        'enabled': True,
        'vendor': 'vlocity',
        'description': 'Integration Procedure - Use vlocity_config.yaml for queries'
    },
    
    'DataRaptor': {
        'api': 'vlocity',
        'object': 'vlocity_cmt__DRBundle__c',
        'name_field': 'vlocity_cmt__DRMapName__c',
        'date_field': 'LastModifiedDate',
        'enabled': True,
        'vendor': 'vlocity',
        'description': 'DataRaptor - Use vlocity_config.yaml for queries'
    },
    'CalculationMatrixVersion': {
        'api': 'vlocity',
        'object': 'vlocity_cmt__CalculationMatrixVersion__c',
        'name_field': 'Name',
        'date_field': 'LastModifiedDate',
        'enabled': True,
        'vendor': 'vlocity',
        'description': 'Calculation Matrix Version'
    },
    
    'VlocityPicklist': {
        'api': 'vlocity', 
        'object': 'vlocity_cmt__Picklist__c',
        'name_field': 'Name',
        'date_field': 'LastModifiedDate',
        'enabled': True,
        'vendor': 'vlocity',
        'description': 'Vlocity Picklist'
    },
    
    'Product2': {
        'api': 'vlocity',  # or 'soql' but vendor should be vlocity
        'object': 'Product2', 
        'name_field': 'Name',
        'date_field': 'LastModifiedDate',
        'enabled': True,
        'vendor': 'vlocity',  # ← This is key
        'description': 'Products'
    }
}


def get_component_query_config(component_type: str) -> dict:
    """
    Get query configuration for a component type
    
    Args:
        component_type: Type of component (e.g., 'ApexClass', 'LightningComponentBundle')
    
    Returns:
        Configuration dict or None if not found
    
    Example:
        >>> config = get_component_query_config('ApexClass')
        >>> config['api']
        'soql'
    """
    return COMPONENT_QUERY_CONFIG.get(component_type)


def is_vlocity_component(component_type: str) -> bool:
    """
    Check if component is a Vlocity/OmniStudio component
    
    Args:
        component_type: Type of component
    
    Returns:
        True if Vlocity component, False otherwise
    
    Example:
        >>> is_vlocity_component('OmniScript')
        True
        >>> is_vlocity_component('ApexClass')
        False
    """
    config = get_component_query_config(component_type)
    if not config:
        return False
    return config.get('vendor') == 'vlocity' or config.get('api') == 'vlocity'


def get_all_enabled_types() -> list:
    """
    Get list of all enabled component types
    
    Returns:
        List of component type names that are enabled
    
    Example:
        >>> enabled = get_all_enabled_types()
        >>> 'ApexClass' in enabled
        True
    """
    return [
        comp_type 
        for comp_type, config in COMPONENT_QUERY_CONFIG.items() 
        if config.get('enabled', True)
    ]


def get_components_by_api(api_type: str) -> list:
    """
    Get all component types that use a specific API
    
    Args:
        api_type: 'soql', 'tooling', or 'vlocity'
    
    Returns:
        List of component types using that API
    
    Example:
        >>> tooling_types = get_components_by_api('tooling')
        >>> 'LightningComponentBundle' in tooling_types
        True
    """
    return [
        comp_type
        for comp_type, config in COMPONENT_QUERY_CONFIG.items()
        if config.get('api') == api_type and config.get('enabled', True)
    ]


def get_enabled_validators(validation_level: str) -> List[str]:
    """
    Get list of enabled validators for a validation level
    """
    if not VALIDATION_CONFIG_AVAILABLE:
        return []
    
    level_config = VALIDATION_CONFIG['levels'].get(validation_level, {})
    validators = level_config.get('validators', [])
    
    # Filter only enabled validators
    enabled_validators = []
    for validator_name in validators:
        validator_config = VALIDATION_CONFIG['validators'].get(validator_name, {})
        if validator_config.get('enabled', True):
            enabled_validators.append(validator_name)
    
    return enabled_validators


def can_run_validator(validator_name: str) -> bool:
    """
    Check if validator can run based on access permissions
    """
    if not VALIDATION_CONFIG_AVAILABLE:
        return True
    
    validator_config = VALIDATION_CONFIG['validators'].get(validator_name, {})
    requires_access = validator_config.get('requires_access', 'none')
    
    if requires_access == 'none':
        return True
    
    access_permissions = VALIDATION_CONFIG.get('access_permissions', {})
    
    # 🎯 ADD DETAILED DEBUGGING
    print(f"🔐 DEBUG {validator_name}: requires={requires_access}")
    print(f"🔐 DEBUG Current permissions: git={access_permissions.get('git')}, salesforce={access_permissions.get('salesforce')}")
    
    required_access_list = [acc.strip() for acc in requires_access.split(',')]
    
    missing_access = []
    for access_type in required_access_list:
        has_access = access_permissions.get(access_type, False)
        print(f"🔐 DEBUG Checking {access_type}: {has_access}")
        if not has_access:
            missing_access.append(access_type)
    
    if missing_access:
        print(f"🔐 DEBUG Missing access for {validator_name}: {missing_access}")
        return False
    
    return True

def get_validator_config(validator_name: str) -> Dict:
    """
    Get configuration for a specific validator
    """
    if not VALIDATION_CONFIG_AVAILABLE:
        return {}
    
    return VALIDATION_CONFIG['validators'].get(validator_name, {})

# Quick reference exports
VLOCITY_TYPES = [k for k, v in COMPONENT_QUERY_CONFIG.items() if v.get('vendor') == 'vlocity']
TOOLING_API_TYPES = get_components_by_api('tooling')
SOQL_TYPES = get_components_by_api('soql')


if __name__ == '__main__':
    # Self-test
    print("=" * 80)
    print("VALIDATION CONFIG - SELF TEST")
    print("=" * 80)
    print(f"\n📊 Total component types configured: {len(COMPONENT_QUERY_CONFIG)}")
    print(f"   ✅ Enabled: {len(get_all_enabled_types())}")
    print(f"   ⚠️  Disabled: {len(COMPONENT_QUERY_CONFIG) - len(get_all_enabled_types())}")
    
    print(f"\n🔧 API Breakdown:")
    print(f"   SOQL: {len(SOQL_TYPES)}")
    print(f"   Tooling: {len(TOOLING_API_TYPES)}")
    print(f"   Vlocity: {len(VLOCITY_TYPES)}")
    
    print(f"\n📋 Vlocity Components:")
    for vtype in VLOCITY_TYPES:
        print(f"   - {vtype}")
    
    print(f"\n🔧 Tooling API Components:")
    for ttype in TOOLING_API_TYPES:
        print(f"   - {ttype}")
    
    print("\n" + "=" * 80)
    print("✅ Configuration valid!")
    print("=" * 80)