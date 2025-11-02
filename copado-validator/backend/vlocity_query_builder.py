"""
Vlocity Query Builder - Updated with actual Salesforce queries

This version handles the real Vlocity structure:
- OmniScript and IntegrationProcedure are in vlocity_cmt__OmniScript__c
- DataRaptor is in vlocity_cmt__DRBundle__c
- OmniScript: Strip language suffixes (_English, etc.)
- IntegrationProcedure: Use ProcedureKey__c field
- DataRaptor: Use DRMapName__c field
"""

import yaml
import logging
import re
from typing import Dict, List, Optional
from pathlib import Path

log = logging.getLogger(__name__)


class VlocityQueryBuilder:
    """Build SOQL queries for Vlocity components based on actual Salesforce structure"""
    
    def __init__(self, config_path: str = "vlocity_config.yaml"):
        """Load configuration from YAML file"""
        self.config = self._load_config(config_path)
        
    def _load_config(self, config_path: str) -> Dict:
        """Load config from file or use defaults"""
        try:
            if Path(config_path).exists():
                with open(config_path, 'r') as f:
                    config = yaml.safe_load(f)
                log.info(f"✅ Loaded Vlocity config from {config_path}")
                log.info(f"   Namespace: {config.get('namespace', 'vlocity_cmt')}")
                return config
            else:
                log.warning(f"⚠️  Config file {config_path} not found, using defaults")
                return self._get_default_config()
        except Exception as e:
            log.error(f"❌ Error loading config: {e}")
            return self._get_default_config()
    
    def _get_default_config(self) -> Dict:
        """Default configuration matching your Salesforce org"""
        return {
            'namespace': 'vlocity_cmt',
            'components': {
                'OmniScript': {
                    'object': 'vlocity_cmt__OmniScript__c',
                    'fields': ['Name', 'CreatedDate', 'LastModifiedDate', 
                              'vlocity_cmt__Type__c', 'vlocity_cmt__SubType__c',
                              'vlocity_cmt__Version__c', 'vlocity_cmt__OmniProcessType__c'],
                    'filter_field': 'vlocity_cmt__OmniProcessType__c',
                    'filter_value': 'OmniScript',
                    'search_field': 'Name',
                    'strip_suffixes': ['_English', '_Spanish', '_French'],
                    'order_by': 'CreatedDate DESC',
                    'limit': 100
                },
                'IntegrationProcedure': {
                    'object': 'vlocity_cmt__OmniScript__c',
                    'fields': ['Name', 'CreatedDate', 'LastModifiedDate',
                              'vlocity_cmt__Type__c', 'vlocity_cmt__SubType__c',
                              'vlocity_cmt__ProcedureKey__c', 'vlocity_cmt__IsProcedure__c'],
                    'filter_field': 'vlocity_cmt__IsProcedure__c',
                    'filter_value': 'true',
                    'search_field': 'vlocity_cmt__ProcedureKey__c',
                    'order_by': 'CreatedDate DESC',
                    'limit': 100
                },
                'DataRaptor': {
                    'object': 'vlocity_cmt__DRBundle__c',
                    'fields': ['Id', 'Name', 'vlocity_cmt__DRMapName__c',
                              'CreatedDate', 'LastModifiedDate'],
                    'search_field': 'vlocity_cmt__DRMapName__c',
                    'order_by': 'CreatedDate DESC',
                    'limit': 100
                }
            },
            'settings': {
                'strip_type_prefix': True,
                'fix_doubled_prefix': True
            }
        }
    
    def _clean_component_name(self, api_name: str, component_type: str) -> str:
        """
        Clean component name from Git format to Salesforce format
        
        Examples:
        - "OmniScript.OmniScript.PR_MultiLineorderMobileDigital_English" 
          -> "PR_MultiLineorderMobileDigital" (for OmniScript)
        - "IntegrationProcedure.IntegrationProcedure.PR_UpdateReservationIdDigital"
          -> "PR_UpdateReservationIdDigital" (for IntegrationProcedure)
        - "DataRaptor.PRDRgetDeviceSKU"
          -> "PRDRgetDeviceSKU" (for DataRaptor)
        """
        settings = self.config.get('settings', {})
        name = api_name
        
        # Step 1: Fix doubled prefix (e.g., OmniScript.OmniScript.PR_Name)
        if settings.get('fix_doubled_prefix', True):
            # Pattern: Type.Type.Name -> Type.Name
            pattern = f"{component_type}\\.{component_type}\\."
            if re.search(pattern, name):
                name = re.sub(pattern, f"{component_type}.", name)
                log.debug(f"   Fixed doubled prefix: {api_name} -> {name}")
        
        # Step 2: Strip type prefix (e.g., OmniScript.PR_Name -> PR_Name)
        if settings.get('strip_type_prefix', True):
            if '.' in name:
                name = name.split('.')[-1]
                log.debug(f"   Stripped type prefix: -> {name}")
        
        # Step 3: Strip language suffix for OmniScript
        if component_type == 'OmniScript':
            comp_config = self.config.get('components', {}).get('OmniScript', {})
            suffixes = comp_config.get('strip_suffixes', ['_English'])
            
            for suffix in suffixes:
                if name.endswith(suffix):
                    name = name[:-len(suffix)]
                    log.debug(f"   Stripped language suffix: -> {name}")
                    break
        
        log.debug(f"   Final cleaned name: {name}")
        return name
    
    def build_query_for_component(self, component_name: str, component_type: str) -> Optional[str]:
        """
        Build SOQL query for a specific component using actual Salesforce structure
        
        Args:
            component_name: Component API name (e.g., "OmniScript.PR_MultiLineorderMobileDigital_English")
            component_type: Component type (e.g., "OmniScript")
        
        Returns:
            SOQL query string or None if type not supported
        """
        components_config = self.config.get('components', {})
        
        if component_type not in components_config:
            log.warning(f"⚠️  Component type {component_type} not configured")
            return None
        
        comp_config = components_config[component_type]
        
        # Clean the component name
        clean_name = self._clean_component_name(component_name, component_type)
        
        # Build query
        object_name = comp_config['object']
        fields = comp_config['fields']
        search_field = comp_config['search_field']
        order_by = comp_config.get('order_by', 'CreatedDate DESC')
        limit = comp_config.get('limit', 100)
        
        # Build SELECT clause
        select_clause = f"SELECT {', '.join(fields)}"
        
        # Build FROM clause
        from_clause = f"FROM {object_name}"
        
        # Build WHERE clause
        where_conditions = []
        
        # Add filter conditions (for OmniScript and IntegrationProcedure)
        if 'filter_field' in comp_config:
            filter_field = comp_config['filter_field']
            filter_value = comp_config['filter_value']
            
            # Handle boolean values
            if filter_value in ['true', 'false']:
                where_conditions.append(f"{filter_field} = {filter_value}")
            else:
                where_conditions.append(f"{filter_field} = '{filter_value}'")
        
        # Add search condition
        where_conditions.append(f"{search_field} = '{clean_name}'")
        
        where_clause = f"WHERE {' AND '.join(where_conditions)}"
        
        # Build ORDER BY and LIMIT
        order_clause = f"ORDER BY {order_by}"
        limit_clause = f"LIMIT {limit}"
        
        # Combine all clauses
        query = f"{select_clause} {from_clause} {where_clause} {order_clause} {limit_clause}"
        
        return query
    
    def build_bulk_query(self, components: List[Dict]) -> Dict[str, str]:
        """
        Build queries for multiple components, grouped by type
        
        Args:
            components: List of components with 'api_name' and 'type'
        
        Returns:
            Dict mapping component type to SOQL query
        """
        queries = {}
        
        # Group components by type and clean names
        by_type = {}
        for comp in components:
            comp_type = comp.get('type')
            api_name = comp.get('api_name', '')
            
            if comp_type not in by_type:
                by_type[comp_type] = []
            
            # Clean the name
            clean_name = self._clean_component_name(api_name, comp_type)
            by_type[comp_type].append(clean_name)
        
        # Build query for each type
        components_config = self.config.get('components', {})
        
        for comp_type, names in by_type.items():
            if comp_type not in components_config:
                log.warning(f"⚠️  Skipping unconfigured type: {comp_type}")
                continue
            
            comp_config = components_config[comp_type]
            
            # Build query parts
            object_name = comp_config['object']
            fields = comp_config['fields']
            search_field = comp_config['search_field']
            order_by = comp_config.get('order_by', 'CreatedDate DESC')
            limit = comp_config.get('limit', 100)
            
            select_clause = f"SELECT {', '.join(fields)}"
            from_clause = f"FROM {object_name}"
            
            # WHERE conditions
            where_conditions = []
            
            # Add filter (for OmniScript and IntegrationProcedure)
            if 'filter_field' in comp_config:
                filter_field = comp_config['filter_field']
                filter_value = comp_config['filter_value']
                
                if filter_value in ['true', 'false']:
                    where_conditions.append(f"{filter_field} = {filter_value}")
                else:
                    where_conditions.append(f"{filter_field} = '{filter_value}'")
            
            # Add search (IN clause for multiple names)
            if len(names) == 1:
                where_conditions.append(f"{search_field} = '{names[0]}'")
            else:
                names_in = "(" + ", ".join([f"'{n}'" for n in names]) + ")"
                where_conditions.append(f"{search_field} IN {names_in}")
            
            where_clause = f"WHERE {' AND '.join(where_conditions)}"
            order_clause = f"ORDER BY {order_by}"
            limit_clause = f"LIMIT {limit}"
            
            queries[comp_type] = f"{select_clause} {from_clause} {where_clause} {order_clause} {limit_clause}"
        
        return queries


# Example usage and testing
if __name__ == "__main__":
    logging.basicConfig(level=logging.DEBUG)
    
    builder = VlocityQueryBuilder()
    
    print("=" * 100)
    print("VLOCITY QUERY BUILDER - TEST WITH ACTUAL SALESFORCE STRUCTURE")
    print("=" * 100)
    
    # Test 1: OmniScript with language suffix
    print("\n=== Test 1: OmniScript (with _English suffix) ===")
    api_name = "OmniScript.OmniScript.PR_MultiLineorderMobileDigital_English"
    print(f"Input: {api_name}")
    query = builder.build_query_for_component(api_name, "OmniScript")
    print(f"\nQuery:\n{query}")
    print("\nExpected: Should search for 'PR_MultiLineorderMobileDigital' (without _English)")
    
    # Test 2: IntegrationProcedure
    print("\n" + "=" * 100)
    print("=== Test 2: IntegrationProcedure ===")
    api_name = "IntegrationProcedure.IntegrationProcedure.PR_UpdateReservationIdDigital"
    print(f"Input: {api_name}")
    query = builder.build_query_for_component(api_name, "IntegrationProcedure")
    print(f"\nQuery:\n{query}")
    print("\nExpected: Should use ProcedureKey__c = 'PR_UpdateReservationIdDigital'")
    
    # Test 3: DataRaptor
    print("\n" + "=" * 100)
    print("=== Test 3: DataRaptor ===")
    api_name = "DataRaptor.PRDRgetDeviceSKU"
    print(f"Input: {api_name}")
    query = builder.build_query_for_component(api_name, "DataRaptor")
    print(f"\nQuery:\n{query}")
    print("\nExpected: Should use DRMapName__c = 'PRDRgetDeviceSKU'")
    
    # Test 4: Bulk query
    print("\n" + "=" * 100)
    print("=== Test 4: Bulk Query ===")
    components = [
        {'api_name': 'OmniScript.OmniScript.PR_MultiLineorderMobileDigital_English', 'type': 'OmniScript'},
        {'api_name': 'IntegrationProcedure.IntegrationProcedure.PR_UpdateReservationIdDigital', 'type': 'IntegrationProcedure'},
        {'api_name': 'DataRaptor.PRDRgetDeviceSKU', 'type': 'DataRaptor'},
    ]
    
    queries = builder.build_bulk_query(components)
    
    for comp_type, query in queries.items():
        print(f"\n--- {comp_type} Query ---")
        print(query)
    
    print("\n" + "=" * 100)
    print("✅ All tests completed!")
    print("=" * 100)