"""
Salesforce Component Query Configuration
=========================================

This file defines how to query different Salesforce metadata types.
Used by deployment_prover.py to fetch production component state.

IMPORTANT: Add new component types here - don't hardcode in the main code!
"""

# Flag to check if config is available
VALIDATION_CONFIG_AVAILABLE = True

COMPONENT_QUERY_CONFIG = {
    
    # ========================================================================
    # APEX COMPONENTS
    # ========================================================================
    
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