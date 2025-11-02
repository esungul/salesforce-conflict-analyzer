# component_mapper.py
import re
from typing import Dict, List, Optional
from component_config import COMPONENT_CONFIG

class ComponentMapper:
    """Configuration-driven component mapping"""
    
    @classmethod
    def file_to_component(cls, file_path: str) -> Optional[Dict]:
        """Convert file path to Salesforce component using configuration"""
        for comp_type, config in COMPONENT_CONFIG.items():
            for pattern in config['patterns']:
                match = re.match(pattern, file_path)
                if match:
                    api_name = cls._extract_api_name(config['api_name_extraction'], match, file_path)
                    return {
                        'type': comp_type,
                        'api_name': api_name,
                        'file_path': file_path,
                        'config': config  # Include config for verification
                    }
        return None
    
    @classmethod
    def _extract_api_name(cls, extraction_method: str, match: re.Match, file_path: str) -> str:
        """Extract API name based on configuration"""
        if extraction_method == "folder_name":
            # For Vlocity components: use the folder name
            return match.group(1)
        
        elif extraction_method == "file_name_no_ext":
            # For most components: use file name without extension
            base_name = match.group(1)
            # Remove common suffixes
            for suffix in ['.cls', '.trigger', '.profile', '.permissionset', 
                          '.object', '.layout', '.flow', '-meta.xml']:
                base_name = base_name.replace(suffix, '')
            return base_name
        
        elif extraction_method == "object_field_combination":
            # For custom fields: ObjectName.FieldName
            object_name = match.group(1)
            field_name = match.group(2).replace('.field-meta.xml', '')
            return f"{object_name}.{field_name}"
        
        else:
            # Default: use first capture group
            return match.group(1)
    
    @classmethod
    def map_files_to_components(cls, file_paths: List[str]) -> List[Dict]:
        """Convert multiple file paths to components, removing duplicates"""
        components = []
        seen_components = set()
        
        for file_path in file_paths:
            component = cls.file_to_component(file_path)
            if component:
                comp_key = f"{component['type']}:{component['api_name']}"
                if comp_key not in seen_components:
                    seen_components.add(comp_key)
                    components.append(component)
        
        return components
    
    @classmethod
    def get_supported_component_types(cls) -> List[str]:
        """Get list of all supported component types"""
        return list(COMPONENT_CONFIG.keys())
    
    @classmethod
    def get_component_config(cls, comp_type: str) -> Optional[Dict]:
        """Get configuration for a specific component type"""
        return COMPONENT_CONFIG.get(comp_type)