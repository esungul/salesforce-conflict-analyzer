import yaml
from typing import Dict, Optional

class ComponentQueryBuilder:
    """Build Salesforce queries based on component_types.yaml"""
    
    def __init__(self, yaml_path='component_types.yaml'):
        with open(yaml_path, 'r') as f:
            self.config = yaml.safe_load(f)
        
        # Map YAML types to Salesforce query info
        self.query_map = self._build_query_map()
    
    def _build_query_map(self) -> Dict:
        """Build query configuration from YAML"""
        query_map = {}
        
        for comp_type, config in self.config.get('types', {}).items():
            domain = config.get('domain')
            kind = config.get('kind')
            
            # Salesforce single-file components
            if domain == 'salesforce' and kind == 'single_file':
                query_map[comp_type] = {
                    'api': 'soql',  # Default to SOQL
                    'object': comp_type,
                    'name_field': 'Name',
                    'date_field': 'LastModifiedDate'
                }
            
            # Vlocity bundle components
            elif domain == 'vlocity' and kind == 'bundle':
                query_map[comp_type] = {
                    'api': 'skip',  # Vlocity needs special handling
                    'object': None,
                    'note': 'Vlocity components not queryable via standard API'
                }
        
        # Override specific types that need Tooling API
        tooling_types = [
            'LightningComponentBundle',
            'AuraDefinitionBundle',
            'CustomObject',
            'CustomField',
            'Flow',
            'ValidationRule',
            'WorkflowRule'
        ]
        
        for comp_type in tooling_types:
            if comp_type in query_map:
                query_map[comp_type]['api'] = 'tooling'
                # LWC/Aura use DeveloperName
                if comp_type in ['LightningComponentBundle', 'AuraDefinitionBundle']:
                    query_map[comp_type]['name_field'] = 'DeveloperName'
        
        return query_map
    
    def get_query_strategy(self, comp_type: str) -> Optional[Dict]:
        """Get query strategy for component type"""
        return self.query_map.get(comp_type)
    
    def can_query_timestamp(self, comp_type: str) -> bool:
        """Check if we can query timestamp for this type"""
        strategy = self.get_query_strategy(comp_type)
        return strategy and strategy['api'] != 'skip'