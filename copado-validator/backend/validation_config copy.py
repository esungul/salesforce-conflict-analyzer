"""
validation_config.py
====================
Configuration-driven validation system for deployment verification

📋 QUICK START:
1. Update 'access_permissions' based on your environment
2. Enable/disable validators as needed
3. Customize validation levels
4. Deploy and test!
"""

from typing import Optional, Tuple,Dict,List


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
            'enabled': True,
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
                'commit_contents',
                'file_mapping'
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
                'file_mapping',
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
    # =================================================================
    # SALESFORCE STANDARD COMPONENTS (SOQL - Always Available)
    # =================================================================
    
    'ApexClass': {
        'api': 'soql',
        'object': 'ApexClass',
        'name_field': 'Name',
        'date_field': 'LastModifiedDate',
        'enabled': True,
        'description': 'Apex classes'
    },
    
    'ApexTrigger': {
        'api': 'soql',
        'object': 'ApexTrigger',
        'name_field': 'Name',
        'date_field': 'LastModifiedDate',
        'enabled': True,
        'description': 'Apex triggers'
    },
    
    'ApexPage': {
        'api': 'soql',
        'object': 'ApexPage',
        'name_field': 'Name',
        'date_field': 'LastModifiedDate',
        'enabled': True,
        'description': 'Visualforce pages'
    },
    
    'ApexComponent': {
        'api': 'soql',
        'object': 'ApexComponent',
        'name_field': 'Name',
        'date_field': 'LastModifiedDate',
        'enabled': True,
        'description': 'Visualforce components'
    },
    
    'StaticResource': {
        'api': 'soql',
        'object': 'StaticResource',
        'name_field': 'Name',
        'date_field': 'LastModifiedDate',
        'enabled': True,
        'description': 'Static resources'
    },
    
    'Profile': {
        'api': 'soql',
        'object': 'Profile',
        'name_field': 'Name',
        'date_field': 'LastModifiedDate',
        'enabled': True,
        'description': 'Profiles'
    },
    
    'PermissionSet': {
        'api': 'soql',
        'object': 'PermissionSet',
        'name_field': 'Name',
        'date_field': 'LastModifiedDate',
        'enabled': True,
        'description': 'Permission sets'
    },
    
    'Group': {
        'api': 'soql',
        'object': 'Group',
        'name_field': 'DeveloperName',
        'date_field': 'LastModifiedDate',
        'enabled': True,
        'description': 'Public groups'
    },
    
    'EmailTemplate': {
        'api': 'soql',
        'object': 'EmailTemplate',
        'name_field': 'DeveloperName',
        'date_field': 'LastModifiedDate',
        'enabled': True,
        'description': 'Email templates'
    },
    
    'Report': {
        'api': 'soql',
        'object': 'Report',
        'name_field': 'DeveloperName',
        'date_field': 'LastModifiedDate',
        'enabled': True,
        'description': 'Reports'
    },
    
    'Dashboard': {
        'api': 'soql',
        'object': 'Dashboard',
        'name_field': 'DeveloperName',
        'date_field': 'LastModifiedDate',
        'enabled': True,
        'description': 'Dashboards'
    },
    
    # =================================================================
    # TOOLING API COMPONENTS (Require Tooling API Access)
    # =================================================================
    
    'LightningComponentBundle': {
        'api': 'tooling',
        'object': 'LightningComponentBundle',
        'name_field': 'DeveloperName',
        'date_field': 'LastModifiedDate',
        'enabled': True,  # Set to False if you don't have Tooling API access
        'requires_access': 'metadata_api',
        'description': 'Lightning Web Components'
    },
    
    'AuraDefinitionBundle': {
        'api': 'tooling',
        'object': 'AuraDefinitionBundle',
        'name_field': 'DeveloperName',
        'date_field': 'LastModifiedDate',
        'enabled': True,  # Set to False if you don't have Tooling API access
        'requires_access': 'metadata_api',
        'description': 'Aura components'
    },
    
    'Flow': {
        'api': 'tooling',
        'object': 'Flow',
        'name_field': 'DeveloperName',
        'date_field': 'LastModifiedDate',
        'enabled': False,  # Enable when ready to support
        'requires_access': 'metadata_api',
        'description': 'Flows'
    },
    
    'CustomObject': {
        'api': 'tooling',
        'object': 'CustomObject',
        'name_field': 'DeveloperName',
        'date_field': 'LastModifiedDate',
        'enabled': False,  # Enable when ready to support
        'requires_access': 'metadata_api',
        'description': 'Custom objects'
    },
    
    'CustomField': {
        'api': 'tooling',
        'object': 'CustomField',
        'name_field': 'DeveloperName',
        'date_field': 'LastModifiedDate',
        'enabled': False,  # Enable when ready to support
        'requires_access': 'metadata_api',
        'description': 'Custom fields',
        'note': 'Queries by field API name, not Object.Field format'
    },
    
    'ValidationRule': {
        'api': 'tooling',
        'object': 'ValidationRule',
        'name_field': 'ValidationName',
        'date_field': 'LastModifiedDate',
        'enabled': False,  # Enable when ready to support
        'requires_access': 'metadata_api',
        'description': 'Validation rules'
    },
    
    'WorkflowRule': {
        'api': 'tooling',
        'object': 'WorkflowRule',
        'name_field': 'Name',
        'date_field': 'LastModifiedDate',
        'enabled': False,  # Enable when ready to support
        'requires_access': 'metadata_api',
        'description': 'Workflow rules'
    },
    
    'Layout': {
        'api': 'tooling',
        'object': 'Layout',
        'name_field': 'Name',
        'date_field': 'LastModifiedDate',
        'enabled': False,  # Enable when ready to support
        'requires_access': 'metadata_api',
        'description': 'Page layouts'
    },
    
    'FlexiPage': {
        'api': 'tooling',
        'object': 'FlexiPage',
        'name_field': 'DeveloperName',
        'date_field': 'LastModifiedDate',
        'enabled': False,  # Enable when ready to support
        'requires_access': 'metadata_api',
        'description': 'Lightning pages'
    },
    
    'CustomTab': {
        'api': 'tooling',
        'object': 'CustomTab',
        'name_field': 'Name',
        'date_field': 'LastModifiedDate',
        'enabled': False,  # Enable when ready to support
        'requires_access': 'metadata_api',
        'description': 'Custom tabs'
    },
    
    'CustomMetadata': {
        'api': 'tooling',
        'object': 'CustomMetadata',
        'name_field': 'DeveloperName',
        'date_field': 'LastModifiedDate',
        'enabled': False,  # Enable when ready to support
        'requires_access': 'metadata_api',
        'description': 'Custom metadata types'
    },
    
    'CustomLabel': {
        'api': 'tooling',
        'object': 'ExternalString',  # CustomLabels use ExternalString in Tooling API
        'name_field': 'Name',
        'date_field': 'LastModifiedDate',
        'enabled': False,  # Enable when ready to support
        'requires_access': 'metadata_api',
        'description': 'Custom labels'
    },
    
    # =================================================================
    # VLOCITY/OMNISTUDIO COMPONENTS (Cannot be queried via standard API)
    # =================================================================
    
    'OmniScript': {
        'api': 'skip',
        'enabled': True,
        'note': 'Vlocity/OmniStudio components not queryable via standard Salesforce API',
        'description': 'OmniScripts'
    },
    
    'IntegrationProcedure': {
        'api': 'skip',
        'enabled': True,
        'note': 'Vlocity/OmniStudio components not queryable via standard Salesforce API',
        'description': 'Integration Procedures'
    },
    
    'DataRaptor': {
        'api': 'skip',
        'enabled': True,
        'note': 'Vlocity/OmniStudio components not queryable via standard Salesforce API',
        'description': 'DataRaptors'
    },
    
    'Product2': {
        'api': 'skip',
        'enabled': True,
        'note': 'Product catalog items not suitable for timestamp validation',
        'description': 'Products'
    },
    
    'CalculationMatrix': {
        'api': 'skip',
        'enabled': True,
        'note': 'Vlocity components not queryable via standard API',
        'description': 'Calculation matrices'
    },
    
    'CalculationMatrixVersion': {
        'api': 'skip',
        'enabled': True,
        'note': 'Vlocity components not queryable via standard API',
        'description': 'Calculation matrix versions'
    },
    
    'Catalog': {
        'api': 'skip',
        'enabled': True,
        'note': 'Vlocity components not queryable via standard API',
        'description': 'Catalogs'
    },
    
    'AttributeCategory': {
        'api': 'skip',
        'enabled': True,
        'note': 'Vlocity components not queryable via standard API',
        'description': 'Attribute categories'
    },
    
    'PriceList': {
        'api': 'skip',
        'enabled': True,
        'note': 'Vlocity components not queryable via standard API',
        'description': 'Price lists'
    },
    
    'OrchestrationItemDefinition': {
        'api': 'skip',
        'enabled': True,
        'note': 'Vlocity components not queryable via standard API',
        'description': 'Orchestration items'
    },
    
    'OrchestrationDependencyDefinition': {
        'api': 'skip',
        'enabled': False,
        'note': 'Vlocity components not queryable via standard API',
        'description': 'Orchestration dependencies'
    }
}

def get_component_query_config(comp_type: str) -> Optional[Dict]:
    """Get query configuration for component type"""
    config = COMPONENT_QUERY_CONFIG.get(comp_type)
    
    # Check if enabled
    if config and config.get('enabled', False):
        # Check access requirements
        requires = config.get('requires_access')
        if requires and not VALIDATION_CONFIG['access_permissions'].get(requires, False):
            return None  # No access
        return config
    
    return None  # Not enabled or not found



def get_enabled_validators(level='standard'):
    """Get enabled validators for level"""
    config = VALIDATION_CONFIG
    level_config = config['levels'].get(level, config['levels']['standard'])
    validators_for_level = level_config['validators']
    
    enabled = []
    for validator_name in validators_for_level:
        validator = config['validators'].get(validator_name)
        if not validator or not validator.get('enabled', False):
            continue
        
        required_access = validator.get('requires_access', 'none')
        if required_access != 'none':
            access_list = required_access.split(',')
            has_access = all(
                config['access_permissions'].get(access.strip(), False) 
                for access in access_list
            )
            if not has_access and validator.get('failure_mode') == 'skip':
                continue
        
        enabled.append(validator_name)
    
    enabled.sort(key=lambda v: config['validators'][v]['execution_order'])
    return enabled

def can_run_validator(validator_name):
    """Check if validator can run"""
    config = VALIDATION_CONFIG
    validator = config['validators'].get(validator_name)
    
    if not validator or not validator.get('enabled', False):
        return False
    
    required_access = validator.get('requires_access', 'none')
    if required_access == 'none':
        return True
    
    access_list = required_access.split(',')
    return all(
        config['access_permissions'].get(access.strip(), False) 
        for access in access_list
    )

def get_validator_config(validator_name):
    """Get validator configuration"""
    return VALIDATION_CONFIG['validators'].get(validator_name)