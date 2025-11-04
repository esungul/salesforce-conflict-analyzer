"""
Vlocity Query Builder - Updated with configuration-driven name cleaning
"""

import yaml
import logging
import re
import urllib.parse
from typing import Dict, List, Optional
from pathlib import Path

log = logging.getLogger(__name__)


class VlocityQueryBuilder:
    """Build SOQL queries for Vlocity components with configuration-driven name cleaning"""
    
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
                },
                'Product2ss': {
                    'object': 'Product2',
                    'fields': ['Id', 'Name', 'ProductCode', 'Description', 'IsActive',
                              'CreatedDate', 'LastModifiedDate'],
                    'search_field': 'Name',
                    'order_by': 'CreatedDate DESC',
                    'limit': 100,
                    # NAME CLEANING RULES FOR PRODUCT2
                    'strip_type_prefix': True,
                    'url_decode': True,
                    'extract_pattern': '^([^(]+)',
                    'remove_patterns': [
                        '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}',
                        '\\s*/\\s*$',
                        '\\s*\\([^)]*\\)\\s*$'
                    ]
                }
            },
            'settings': {
                'strip_type_prefix': True,
                'fix_doubled_prefix': True
            }
        }
    
    def _clean_component_nameback(self, api_name: str, component_type: str) -> str:
        """
        Clean component name using configuration-driven rules
        """
        name = api_name
        log.debug(f"🧹 Cleaning {component_type}: {name}")
        
        # Get component configuration
        comp_config = self.config.get('components', {}).get(component_type, {})
        
        # Step 1: Strip type prefix
        if comp_config.get('strip_type_prefix', True):
            if '.' in name:
                name = name.split('.')[-1]
                log.debug(f"   Stripped type prefix: -> {name}")
        
        # Step 2: URL decode if configured
        if comp_config.get('url_decode', False):
            try:
                decoded_name = urllib.parse.unquote(name)
                if decoded_name != name:
                    log.debug(f"   URL decoded: {name} -> {decoded_name}")
                name = decoded_name
            except Exception as e:
                log.warning(f"   URL decode failed: {e}")
                
        if component_type == 'Product2':
            # Try to extract Product Code between ( and /
            pattern = r"\(([^/]+)"
            match = re.search(pattern, name)
            if match:
                product_code = match.group(1).strip()
                log.debug(f"   🎯 EXTRACTED Product Code: '{product_code}'")
                return product_code
            else:
                log.debug(f"   ⚠️  No Product Code pattern matched")
        
        # Step 3: Extract pattern if configured
        extract_pattern = comp_config.get('extract_pattern')
        if extract_pattern:
            match = re.match(extract_pattern, name.strip())
            if match:
                extracted = match.group(1).strip()
                log.debug(f"   Extracted pattern '{extract_pattern}': {name} -> {extracted}")
                name = extracted
        
        # Step 4: Remove patterns if configured
        remove_patterns = comp_config.get('remove_patterns', [])
        for pattern in remove_patterns:
            original = name
            name = re.sub(pattern, '', name)
            if name != original:
                log.debug(f"   Removed pattern '{pattern}': {original} -> {name}")
        
        # Step 5: Strip suffixes (for OmniScript, etc.)
        strip_suffixes = comp_config.get('strip_suffixes', [])
        for suffix in strip_suffixes:
            if name.endswith(suffix):
                name = name[:-len(suffix)]
                log.debug(f"   Stripped suffix '{suffix}': -> {name}")
                break
        
        # Step 6: Final cleanup
        name = name.strip()
        
        log.debug(f"   ✅ Final cleaned name: {name}")
        return name
    
        # vlocity_query_builder.py - FIX PATTERN MATCHING

    def _clean_component_name(self, api_name: str, component_type: str) -> str:
        """
        Clean component name using configuration-driven rules
        """
        name = api_name
        log.debug(f"🧹 Cleaning {component_type}: {name}")
        
        comp_config = self.config.get('components', {}).get(component_type, {})
        
        # Step 1: Strip type prefix
        if comp_config.get('strip_type_prefix', True):
            if '.' in name:
                name = name.split('.')[-1]
                log.debug(f"   Stripped type prefix: -> {name}")
        
        # Step 2: URL decode if configured
        if comp_config.get('url_decode', False):
            try:
                decoded_name = urllib.parse.unquote(name)
                if decoded_name != name:
                    log.debug(f"   URL decoded: {name} -> {decoded_name}")
                name = decoded_name
            except Exception as e:
                log.warning(f"   URL decode failed: {e}")
        
        # Step 3: Extract pattern if configured - FIXED: use re.search() instead of re.match()
        extract_pattern = comp_config.get('extract_pattern')
        if extract_pattern:
            log.debug(f"   🎯 Applying extract_pattern: '{extract_pattern}'")
            # ✅ FIX: Change from re.match() to re.search()
            match = re.search(extract_pattern, name.strip())
            if match:
                # Check if we have capturing groups
                if match.lastindex and match.lastindex >= 1:
                    extracted = match.group(1).strip()
                    log.debug(f"   Extracted: '{name}' -> '{extracted}'")
                    name = extracted
                else:
                    log.debug(f"   ⚠️  Pattern matched but no capturing groups found")
            else:
                log.debug(f"   ⚠️  Pattern '{extract_pattern}' didn't match '{name}'")
        
        # Step 4: Final cleanup
        name = name.strip()
        
        log.debug(f"   ✅ Final cleaned name: {name}")
        return name
        
    def build_query_for_component(self, component_name: str, component_type: str) -> Optional[str]:
        """
        Build SOQL query for a specific component using actual Salesforce structure
        """
        components_config = self.config.get('components', {})
        
        if component_type not in components_config:
            log.warning(f"⚠️  Component type {component_type} not configured")
            return None
        
        comp_config = components_config[component_type]
        
        # Clean the component name USING CONFIGURED RULES
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
        """
        queries = {}
        
        # Group components by type and clean names
        by_type = {}
        for comp in components:
            comp_type = comp.get('type')
            api_name = comp.get('api_name', '')
            
            if comp_type not in by_type:
                by_type[comp_type] = []
            
            # Clean the name USING CONFIGURED RULES
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


# Quick test function
def test_product2_cleaning():
    """Test Product2 name cleaning"""
    logging.basicConfig(level=logging.DEBUG)
    
    builder = VlocityQueryBuilder()
    
    test_cases = [
        "Product2.Samsung Galaxy S25 Ultra %28LLA_Samsung_Galaxy_S25_Ultra / 9d95bc32-06da-b97f-60ce-808047f576bd%29",
        "Product2.Test%20Product%20%28UUID%29",
        "Product2.Simple Product"
    ]
    
    print("🧪 Testing Product2 Name Cleaning:")
    print("=" * 80)
    
    for git_name in test_cases:
        cleaned = builder._clean_component_name(git_name, "Product2")
        query = builder.build_query_for_component(git_name, "Product2")
        
        print(f"Input:  {git_name}")
        print(f"Output: {cleaned}")
        print(f"Query:  {query}")
        print("-" * 80)


if __name__ == "__main__":
    test_product2_cleaning()