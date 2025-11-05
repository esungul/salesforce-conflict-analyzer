"""
Config Loader - Product Code Lookup with Name to Code Mapping
Accepts product_name from API and maps to product_code
"""

import yaml
from typing import Dict, Any, Optional


class ConfigLoader:
    """Load and retrieve product configurations by product name or code"""
    
    def __init__(self, config_file: str = 'validation_config_conditional.yaml'):
        """
        Initialize config loader
        
        Args:
            config_file: Path to YAML configuration file
        """
        self.config_file = config_file
        self.config = self._load_config()
        self.validation_rules = self.config.get('validation_rules', {})
        self.product_name_to_code_map = self._build_name_to_code_map()
    
    def _load_config(self) -> Dict[str, Any]:
        """Load YAML configuration file"""
        try:
            with open(self.config_file, 'r') as f:
                return yaml.safe_load(f) or {}
        except FileNotFoundError:
            print(f"❌ Config file not found: {self.config_file}")
            return {}
        except yaml.YAMLError as e:
            print(f"❌ Error parsing YAML: {e}")
            return {}
    
    def _build_name_to_code_map(self) -> Dict[str, str]:
        """
        Build a mapping of product_name to product_code
        
        Returns:
            Dict mapping product_name -> product_code
        """
        name_to_code = {}
        
        for code, config in self.validation_rules.items():
            product_name = config.get('product_name')
            if product_name:
                name_to_code[product_name] = code
                # Also add lowercase version for case-insensitive matching
                name_to_code[product_name.lower()] = code
        
        return name_to_code
    
    def resolve_product_code(self, product_identifier: str) -> Optional[str]:
        """
        Resolve product code from either product_name or product_code
        
        Args:
            product_identifier: Can be product_name or product_code
        
        Returns:
            Product code or None
        """
        # Check if it's already a product code (exists as key in validation_rules)
        if product_identifier in self.validation_rules:
            print(f"✅ Product code recognized: {product_identifier}")
            return product_identifier
        
        # Try to find it as a product name
        if product_identifier in self.product_name_to_code_map:
            product_code = self.product_name_to_code_map[product_identifier]
            print(f"✅ Product name '{product_identifier}' mapped to code: {product_code}")
            return product_code
        
        # Try lowercase
        product_identifier_lower = product_identifier.lower()
        if product_identifier_lower in self.product_name_to_code_map:
            product_code = self.product_name_to_code_map[product_identifier_lower]
            print(f"✅ Product name '{product_identifier}' (lowercase) mapped to code: {product_code}")
            return product_code
        
        print(f"⚠️  Product not found: {product_identifier} (not a valid code or name)")
        return None
    
    def get_product_config(self, product_identifier: str, product_type: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """
        Get product configuration by product_name OR product_code
        Falls back to generic config if product not found
        
        Args:
            product_identifier: Can be product_name or product_code
            product_type: Product type (technical or line) - used for fallback
        
        Returns:
            Product configuration dict or None
        """
        
        # Step 1: Resolve product code from name or code
        product_code = self.resolve_product_code(product_identifier)
        
        if product_code and product_code in self.validation_rules:
            return self.validation_rules[product_code]
        
        # Step 2: Use fallback based on product_type
        if product_type:
            fallback_key = self._get_fallback_key(product_type)
            if fallback_key and fallback_key in self.validation_rules:
                print(f"✅ Using fallback config for product_type: {product_type} ({fallback_key})")
                return self.validation_rules[fallback_key]
        
        # Step 3: No configuration found
        print(f"❌ No configuration found for: {product_identifier}")
        return None
    
    def _get_fallback_key(self, product_type: str) -> Optional[str]:
        """
        Get fallback config key based on product type
        
        Args:
            product_type: Product type (technical or line)
        
        Returns:
            Fallback key or None
        """
        product_type_lower = product_type.lower() if product_type else ""
        
        if "technical" in product_type_lower:
            return "FALLBACK_TECHNICAL"
        elif "line" in product_type_lower:
            return "FALLBACK_LINE"
        
        return None
    
    def get_product_attributes(self, product_identifier: str, product_type: Optional[str] = None) -> Optional[list]:
        """
        Get product attributes by product_name or product_code
        
        Args:
            product_identifier: product_name or product_code
            product_type: Product type (for fallback)
        
        Returns:
            List of attribute configs or None
        """
        config = self.get_product_config(product_identifier, product_type)
        if config:
            return config.get('attributes', [])
        return None
    
    def get_product_info(self, product_identifier: str, product_type: Optional[str] = None) -> Optional[Dict[str, str]]:
        """
        Get product info (name, description, type, code)
        
        Args:
            product_identifier: product_name or product_code
            product_type: Product type (for fallback)
        
        Returns:
            Dict with product_name, product_type, description, product_code or None
        """
        config = self.get_product_config(product_identifier, product_type)
        if config:
            # Get the actual product code used
            product_code = self.resolve_product_code(product_identifier)
            return {
                'product_name': config.get('product_name'),
                'product_type': config.get('product_type'),
                'description': config.get('description'),
                'product_code': product_code
            }
        return None
    
    def validate_attribute(self, product_identifier: str, attribute_code: str, 
                          attribute_value: Any, product_type: Optional[str] = None) -> Dict[str, Any]:
        """
        Validate a single attribute against product configuration
        
        Args:
            product_identifier: product_name or product_code
            attribute_code: Attribute code
            attribute_value: Attribute value
            product_type: Product type (for fallback)
        
        Returns:
            Validation result dict
        """
        attributes = self.get_product_attributes(product_identifier, product_type)
        
        if not attributes:
            return {
                'valid': False,
                'error': f'No attributes found for product: {product_identifier}',
                'attribute_code': attribute_code
            }
        
        # Find attribute definition
        attr_def = None
        for attr in attributes:
            if attr.get('code') == attribute_code:
                attr_def = attr
                break
        
        if not attr_def:
            return {
                'valid': False,
                'error': f'Attribute not found: {attribute_code}',
                'attribute_code': attribute_code
            }
        
        # Check if mandatory and value is missing
        if attr_def.get('mandatory', False) and not attribute_value:
            return {
                'valid': False,
                'error': f'Mandatory attribute is empty: {attribute_code}',
                'attribute_code': attribute_code,
                'attribute_name': attr_def.get('name')
            }
        
        # Validate picklist values
        if attribute_value and attr_def.get('type') == 'picklist':
            allowed_values = attr_def.get('allowed_values', [])
            if allowed_values and attribute_value not in allowed_values:
                return {
                    'valid': False,
                    'error': f'Invalid picklist value: {attribute_value}',
                    'attribute_code': attribute_code,
                    'allowed_values': allowed_values,
                    'attribute_name': attr_def.get('name')
                }
        
        # Validate number type
        if attribute_value and attr_def.get('type') == 'number':
            try:
                float(attribute_value)
            except (ValueError, TypeError):
                return {
                    'valid': False,
                    'error': f'Invalid number value: {attribute_value}',
                    'attribute_code': attribute_code,
                    'attribute_name': attr_def.get('name')
                }
        
        return {
            'valid': True,
            'attribute_code': attribute_code,
            'attribute_name': attr_def.get('name'),
            'type': attr_def.get('type')
        }
    
    def validate_all_attributes(self, product_identifier: str, attributes_dict: Dict[str, Any],
                               product_type: Optional[str] = None) -> Dict[str, Any]:
        """
        Validate all attributes for a product
        
        Args:
            product_identifier: product_name or product_code
            attributes_dict: Dict of attributes {code: value}
            product_type: Product type (for fallback)
        
        Returns:
            Validation result dict
        """
        product_info = self.get_product_info(product_identifier, product_type)
        
        if not product_info:
            return {
                'status': 'INVALID',
                'error': f'Product not found: {product_identifier}',
                'product_identifier': product_identifier,
                'valid_attributes': [],
                'invalid_attributes': []
            }
        
        valid_attrs = []
        invalid_attrs = []
        
        for attr_code, attr_value in attributes_dict.items():
            result = self.validate_attribute(product_identifier, attr_code, attr_value, product_type)
            
            if result.get('valid'):
                valid_attrs.append(result)
            else:
                invalid_attrs.append(result)
        
        # Determine overall status
        status = 'VALID' if not invalid_attrs else ('PARTIAL' if valid_attrs else 'INVALID')
        
        return {
            'status': status,
            'product_identifier': product_identifier,
            'product_code': product_info.get('product_code'),
            'product_name': product_info.get('product_name'),
            'product_type': product_info.get('product_type'),
            'valid_attributes': valid_attrs,
            'invalid_attributes': invalid_attrs,
            'summary': {
                'total_validated': len(attributes_dict),
                'valid': len(valid_attrs),
                'invalid': len(invalid_attrs)
            }
        }


# Usage Example
if __name__ == '__main__':
    loader = ConfigLoader('validation_config_conditional.yaml')
    
    # Example 1: Using product_name (from API)
    print("\n" + "="*60)
    print("Example 1: Using product_name (What API receives)")
    print("="*60)
    result = loader.validate_all_attributes(
        product_identifier='Account Level MPI',  # API sends product_name
        attributes_dict={'PR_B2C_ATT_Plan_Type': 'Premium'}
    )
    print(f"Status: {result['status']}")
    print(f"Product Code: {result['product_code']}")
    print(f"Product Name: {result['product_name']}")
    
    # Example 2: Using product_code (backward compatible)
    print("\n" + "="*60)
    print("Example 2: Using product_code (backward compatible)")
    print("="*60)
    result = loader.validate_all_attributes(
        product_identifier='PR_B2C_Mobile_Account_Level_MPI_CFS',  # product_code
        attributes_dict={'PR_B2C_ATT_Plan_Type': 'Premium'}
    )
    print(f"Status: {result['status']}")
    print(f"Product Code: {result['product_code']}")
    
    # Example 3: Tablet product by name
    print("\n" + "="*60)
    print("Example 3: Liberty Tablet by name")
    print("="*60)
    result = loader.validate_all_attributes(
        product_identifier='Liberty U-Pick Mobile Tablet',  # product_name
        attributes_dict={
            'PR_B2C_Mb_ATT_Device_Type': 'Tablet',
            'PR_B2C_Mb_ATT_Data_Allowance': '20GB'
        }
    )
    print(f"Status: {result['status']}")
    print(f"Product Code: {result['product_code']}")
    print(f"Valid: {result['summary']['valid']}")
    
    # Example 4: Get product info by name
    print("\n" + "="*60)
    print("Example 4: Get product info by name")
    print("="*60)
    info = loader.get_product_info('Mobile Line Provisioning CFS')
    print(f"Info: {info}")
    
    # Example 5: List all product names
    print("\n" + "="*60)
    print("Example 5: All available products")
    print("="*60)
    for product_name, product_code in loader.product_name_to_code_map.items():
        if not product_name.islower() or product_name == product_name.lower():  # Show original case
            print(f"  {product_name} → {product_code}")