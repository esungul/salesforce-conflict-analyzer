"""
Smart Product Validator with Auto-Detection and Product-Specific Configuration

This module provides intelligent product validation with automatic device type detection,
product-specific configuration matching, and comprehensive attribute validation.

Features:
- Auto-detects device type from product properties
- Matches products by code or name to product-specific configs
- Fallback support for unknown products
- Picklist validation with detailed error reporting
- Comprehensive logging for debugging
- Salesforce integration
- Support for passing Salesforce client from main.py

Author: Product Validation Team
Version: 2.1 (With SF Client Support)
"""

import logging
import json
from typing import Optional, Dict, Any, List, Tuple
from datetime import datetime
from enum import Enum

import yaml
from flask import Flask, request, jsonify
from simple_salesforce import Salesforce, SalesforceAuthenticationFailed

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(levelname)s:%(name)s:%(message)s'
)
logger = logging.getLogger(__name__)

# ============================================================================
# CONFIGURATION & CONSTANTS
# ============================================================================

VALIDATION_RULES_FILE = 'validation_config_conditional.yaml'
SALESFORCE_CONFIG_FILE = 'config.yaml'

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================


def load_configuration(config_file: str) -> Dict[str, Any]:
    """
    Load YAML configuration file
    
    Args:
        config_file: Path to YAML configuration file
    
    Returns:
        Dictionary containing configuration
    """
    try:
        with open(config_file, 'r') as f:
            config = yaml.safe_load(f)
            logger.info(f"[CONFIG] Loaded configuration from: {config_file}")
            return config if config else {}
    except FileNotFoundError:
        logger.error(f"[CONFIG] Configuration file not found: {config_file}")
        return {}
    except Exception as e:
        logger.error(f"[CONFIG] Error loading configuration: {str(e)}")
        return {}


def get_salesforce_connection(config_file: str = SALESFORCE_CONFIG_FILE) -> Optional[Salesforce]:
    """
    Create Salesforce connection
    
    Args:
        config_file: Path to Salesforce config YAML file
    
    Returns:
        Salesforce connection object or None
    """
    try:
        config = load_configuration(config_file)
        salesforce_config = config.get('salesforce', {})
        
        username = salesforce_config.get('username')
        password = salesforce_config.get('password')
        security_token = salesforce_config.get('security_token')
        instance_url = salesforce_config.get('instance_url', 'https://login.salesforce.com')
        
        if not all([username, password, security_token]):
            logger.error("[SF] Missing Salesforce credentials in config")
            return None
        
        sf = Salesforce(
            username=username,
            password=password,
            security_token=security_token,
            instance_url=instance_url
        )
        
        logger.info("[SF] Salesforce connection established")
        return sf
    
    except SalesforceAuthenticationFailed as e:
        logger.error(f"[SF] Authentication failed: {str(e)}")
        return None
    except Exception as e:
        logger.error(f"[SF] Connection error: {str(e)}")
        return None


# ============================================================================
# CORE VALIDATION FUNCTIONS
# ============================================================================


def auto_detect_validation_method(product: Dict[str, Any]) -> Tuple[str, str]:
    """
    Auto-detect validation method based on product properties
    With fallback detection for products without ParentClass
    
    Returns:
        Tuple of (validation_method, device_type)
        - validation_method: "external_script" or "yaml_config"
        - device_type: "Mobile Device", "Mobile Line", "Technical", etc.
    """
    try:
        parent_class = product.get('ParentClass', '').lower() if product.get('ParentClass') else ''
        is_orderable = product.get('IsOrderable', False)
        product_name = product.get('Name', '').lower() if product.get('Name') else ''
        
        logger.info(f"[AUTO-DETECT] Parent Class: {parent_class}, Orderable: {is_orderable}")
        logger.info(f"[AUTO-DETECT] Product Name: {product_name}")
        
        # RULE 1: Mobile Device Class + Orderable = External Script
        if 'mobile device' in parent_class or 'device' in parent_class:
            if is_orderable:
                logger.info("[AUTO-DETECT] ✓ Mobile Device + Orderable → External Script")
                return "external_script", "MobileDevice"
            else:
                logger.info("[AUTO-DETECT] ✓ Mobile Device + Not Orderable → YAML Config")
                return "yaml_config", "MobileDevice"
        
        # RULE 2: Mobile Line Class = YAML Config
        if 'mobile line' in parent_class or 'line' in parent_class:
            logger.info("[AUTO-DETECT] ✓ Mobile Line Class → YAML Config (LineProduct)")
            return "yaml_config", "LineProduct"
        
        # RULE 3: Technical Class = YAML Config
        if 'technical' in parent_class or 'service' in parent_class:
            logger.info("[AUTO-DETECT] ✓ Technical Class → YAML Config (Technical)")
            return "yaml_config", "Technical"
        
        # ===================================================================
        # FALLBACK DETECTION (for products without ParentClass)
        # ===================================================================
        if not parent_class:
            logger.info("[AUTO-DETECT] ⚠ ParentClass is None, using fallback detection...")
            
            # Check product name for keywords
            if 'technical' in product_name or 'service' in product_name or 'mpi' in product_name:
                logger.info("[AUTO-DETECT] ✓ Detected as Technical (from product name)")
                return "yaml_config", "Technical"
            
            elif 'line' in product_name or 'mobile line' in product_name:
                logger.info("[AUTO-DETECT] ✓ Detected as Mobile Line (from product name)")
                return "yaml_config", "LineProduct"
            
            elif 'device' in product_name or 'phone' in product_name or 'tablet' in product_name:
                logger.info("[AUTO-DETECT] ✓ Detected as Mobile Device (from product name)")
                return "yaml_config", "MobileDevice"
            
            else:
                logger.info("[AUTO-DETECT] ⚠ Could not determine type from product name, defaulting to Technical")
                return "yaml_config", "Technical"
        
        # RULE 4: Other classes = YAML Config by default
        logger.info("[AUTO-DETECT] ✓ Other class → YAML Config")
        return "yaml_config", "Technical"
    
    except Exception as e:
        logger.error(f"[AUTO-DETECT] Error: {str(e)}")
        return "yaml_config", "Technical"


def find_product_config(product_name: str, product_code: Optional[str], device_type: str, validation_rules: Dict) -> Optional[str]:
    """
    Find the specific product config based on product details
    
    Matching priority:
    1. Product-specific config by product code (Product2_Technical_MPI)
    2. Product-specific config by product name (Product2_Technical_AccountLevelMPI)
    3. Generic device type config (Product2_Technical)
    
    Args:
        product_name: Name of the product (e.g., "Account Level MPI")
        product_code: Product code from Salesforce (e.g., "MPI")
        device_type: Device type (Technical, LineProduct, MobileDevice)
        validation_rules: YAML config dictionary
    
    Returns:
        Config key string or None if not found
    
    Example:
        config_key = find_product_config("Account Level MPI", "MPI", "Technical", validation_rules)
        # Returns: "Product2_Technical_MPI"
    """
    
    logger.info(f"[CONFIG MATCH] Finding config for: {product_name} (Code: {product_code}, Type: {device_type})")
    
    # Try 1: Match by product code (most specific)
    if product_code:
        # Remove spaces and special characters from code
        clean_code = product_code
        config_key = clean_code
        
        if config_key in validation_rules:
            logger.info(f"[CONFIG MATCH] ✓ Found by code: {config_key}")
            return config_key
        else:
            logger.debug(f"[CONFIG MATCH] ✗ Code not found: {config_key}")
    
    # Try 2: Match by product name (sanitized)
    if product_name:
        # Remove spaces and special characters from name
        sanitized_name = product_name.replace(" ", "").replace("-", "").replace("_", "")
        config_key = f"Product2_{device_type}_{sanitized_name}"
        
        if config_key in validation_rules:
            logger.info(f"[CONFIG MATCH] ✓ Found by name: {config_key}")
            return config_key
        else:
            logger.debug(f"[CONFIG MATCH] ✗ Name not found: {config_key}")
    
    # Try 3: Generic device type config (fallback)
    config_key = f"Product2_{device_type}"
    if config_key in validation_rules:
        logger.info(f"[CONFIG MATCH] ✓ Using generic config: {config_key}")
        return config_key
    
    # No config found
    logger.warning(f"[CONFIG MATCH] ✗ No config found - tried:")
    if product_code:
        logger.warning(f"  - Product2_{device_type}_{product_code.replace(' ', '')}")
    if product_name:
        logger.warning(f"  - Product2_{device_type}_{product_name.replace(' ', '')}")
    logger.warning(f"  - Product2_{device_type}")
    
    return None


def get_product_from_salesforce(sf: Salesforce, product_name: str) -> Optional[Dict[str, Any]]:
    """
    Query Salesforce for product by name
    
    Args:
        sf: Salesforce connection
        product_name: Name of product to find
    
    Returns:
        Product record dictionary or None
    """
    try:
        logger.info(f"[SF QUERY] Searching for: {product_name}")
        
        query = f"""
            SELECT Id, Name, ProductCode, vlocity_cmt__ParentClassId__r.Name,
                   vlocity_cmt__IsOrderable__c, vlocity_cmt__JSONAttribute__c,
                   IsActive
            FROM Product2
            WHERE Name = '{product_name}'
            AND IsActive = true
        """
        
        response = sf.query(query)
        
        if response['totalSize'] == 0:
            logger.warning(f"[SF QUERY] Product not found: {product_name}")
            return None
        
        product = response['records'][0]
        
        logger.info(f"[SF QUERY] Raw vlocity_cmt__ParentClassId__r: {product.get('vlocity_cmt__ParentClassId__r')}")
        logger.info(f"[SF QUERY] Raw vlocity_cmt__IsOrderable__c: {product.get('vlocity_cmt__IsOrderable__c')}")
        logger.info(f"[SF QUERY] Found: {product_name}")
        
        # Extract parent class name
        parent_class_obj = product.get('vlocity_cmt__ParentClassId__r')
        parent_class = parent_class_obj.get('Name') if parent_class_obj else None
        
        # Map Salesforce fields to our format
        result = {
            'Id': product.get('Id'),
            'Name': product.get('Name'),
            'ProductCode': product.get('ProductCode', ''),
            'ParentClass': parent_class,
            'IsOrderable': product.get('vlocity_cmt__IsOrderable__c', False),
            'vlocity_cmt__JSONAttribute__c': product.get('vlocity_cmt__JSONAttribute__c', '{}')
        }
        
        logger.info(f"[SF QUERY] ParentClass: {parent_class}")
        logger.info(f"[SF QUERY] IsOrderable: {result['IsOrderable']}")
        
        return result
    
    except Exception as e:
        logger.error(f"[SF QUERY] Error querying Salesforce: {str(e)}")
        return None


def validate_attributes(
    configured_attrs: List[Dict[str, Any]],
    product_attrs_json: Dict[str, Any],
    product: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Validate product attributes against configuration
    
    Args:
        configured_attrs: List of attributes from YAML config
        product_attrs_json: Product attributes from Salesforce JSON
        product: Product record from Salesforce
    
    Returns:
        Validation result dictionary with status and details
    """
    
    logger.info(f"[VALIDATE] Starting attribute validation")
    
    present_attributes = []
    missing_attributes = []
    invalid_attributes = []
    
    # =====================================================================
    # STEP 1: Validate configured attributes are present and valid
    # =====================================================================
    
    for attr in configured_attrs:
        attr_code = attr.get('code')
        attr_name = attr.get('name')
        attr_type = attr.get('type', 'text')
        mandatory = attr.get('mandatory', False)
        allowed_values = attr.get('allowed_values', [])
        
        logger.debug(f"[VALIDATE] Checking: {attr_code} (type: {attr_type}, mandatory: {mandatory})")
        
        # Find attribute in product JSON
        attr_value = None
        found = False
        
        # Search in product attributes JSON
        for category, attrs_list in product_attrs_json.items():
            if isinstance(attrs_list, list):
                for product_attr in attrs_list:
                    if product_attr.get('attributeuniquecode__c') == attr_code:
                        attr_value = product_attr.get('value__c')
                        found = True
                        break
            if found:
                break
        
        # =====================================================================
        # STEP 2: Check if attribute is present
        # =====================================================================
        
        if not found:
            if mandatory:
                logger.warning(f"[VALIDATE] ✗ Missing mandatory: {attr_code}")
                missing_attributes.append({
                    'code': attr_code,
                    'name': attr_name,
                    'type': attr_type,
                    'mandatory': True,
                    'error': f"Attribute not found in product"
                })
            else:
                logger.debug(f"[VALIDATE] - Optional attribute not found: {attr_code}")
            continue
        
        # =====================================================================
        # STEP 3: Check if value is set
        # =====================================================================
        
        if not attr_value or attr_value.strip() == '':
            if mandatory:
                logger.warning(f"[VALIDATE] ✗ No value selected (mandatory): {attr_code}")
                invalid_attributes.append({
                    'code': attr_code,
                    'name': attr_name,
                    'type': attr_type,
                    'mandatory': True,
                    'current_value': None,
                    'error': "No value selected (mandatory)"
                })
            else:
                logger.debug(f"[VALIDATE] - Optional attribute empty: {attr_code}")
                present_attributes.append({
                    'code': attr_code,
                    'name': attr_name,
                    'type': attr_type,
                    'mandatory': False,
                    'current_value': None
                })
            continue
        
        # =====================================================================
        # STEP 4: Validate picklist values
        # =====================================================================
        
        if attr_type == 'picklist' and allowed_values:
            if attr_value not in allowed_values:
                logger.warning(f"[VALIDATE] ✗ Invalid picklist value: {attr_code} = {attr_value}")
                invalid_attributes.append({
                    'code': attr_code,
                    'name': attr_name,
                    'type': attr_type,
                    'mandatory': mandatory,
                    'current_value': attr_value,
                    'allowed_values': allowed_values,
                    'error': f"Value '{attr_value}' is not in allowed values"
                })
                continue
        
        # =====================================================================
        # STEP 5: Attribute is valid
        # =====================================================================
        
        logger.debug(f"[VALIDATE] ✓ Valid: {attr_code} = {attr_value}")
        present_attributes.append({
            'code': attr_code,
            'name': attr_name,
            'type': attr_type,
            'mandatory': mandatory,
            'current_value': attr_value,
            'salesforce_allowed_values': allowed_values if attr_type == 'picklist' else None
        })
    
    # =====================================================================
    # STEP 6: Determine overall status
    # =====================================================================
    
    if missing_attributes or invalid_attributes:
        status = "PARTIAL" if present_attributes else "ERROR"
    else:
        status = "VALID"
    
    logger.info(f"[VALIDATE] Status: {status} (Present: {len(present_attributes)}, Missing: {len(missing_attributes)}, Invalid: {len(invalid_attributes)})")
    
    return {
        'status': status,
        'details': {
            'configured_count': len(configured_attrs),
            'present_count': len(present_attributes),
            'missing_count': len(missing_attributes),
            'invalid_count': len(invalid_attributes)
        },
        'present_attributes': present_attributes if present_attributes else None,
        'missing_attributes': missing_attributes if missing_attributes else None,
        'invalid_attributes': invalid_attributes if invalid_attributes else None
    }


def validate_product_auto(
    product_name: str,
    sf: Optional[Salesforce] = None,
    config: Optional[Dict[str, Any]] = None,
    check_salesforce: bool = True
) -> Dict[str, Any]:
    """
    Automatically detect validation method and validate product
    
    Auto-detection logic:
    1. Detects device type from ParentClass or product name
    2. Finds product-specific config by code or name
    3. Falls back to generic device config
    4. Validates against appropriate config
    
    Args:
        product_name: Name of product to validate
        sf: Salesforce connection (optional)
        config: YAML configuration (optional, will load if not provided)
        check_salesforce: Whether to check Salesforce
    
    Returns:
        Validation result dictionary
    """
    
    try:
        logger.info(f"[ENDPOINT] Validating product: {product_name}")
        logger.info(f"[AUTO-VALIDATE] Starting validation for: {product_name}")
        
        # =====================================================================
        # STEP 1: GET PRODUCT FROM SALESFORCE
        # =====================================================================
        
        if not sf:
            sf = get_salesforce_connection()
        
        if not sf:
            logger.warning("[AUTO-VALIDATE] No Salesforce connection, skipping Salesforce validation")
            check_salesforce = False
        
        product = None
        if check_salesforce and sf:
            product = get_product_from_salesforce(sf, product_name)
        
        if not product and check_salesforce:
            logger.warning(f"[SF QUERY] Product not found: {product_name}")
            return {
                "status": "ERROR",
                "message": f"Product not found in Salesforce: {product_name}",
                "product_name": product_name
            }
        
        if product:
            logger.info(f"[SF QUERY] Found: {product_name}")
        
        # Extract product details (or use defaults if not from Salesforce)
        parent_class = product.get('ParentClass', '') if product else ''
        is_orderable = product.get('IsOrderable', False) if product else False
        product_code = product.get('ProductCode', '') if product else ''
        
        logger.info(f"[SF QUERY] ParentClass: {parent_class}")
        logger.info(f"[SF QUERY] IsOrderable: {is_orderable}")
        logger.info(f"[SF QUERY] ProductCode: {product_code}")
        
        # =====================================================================
        # STEP 2: AUTO-DETECT DEVICE TYPE
        # =====================================================================
        
        if not product:
            product = {'Name': product_name, 'ParentClass': '', 'IsOrderable': False}
        
        validation_method, device_type = auto_detect_validation_method(product)
        logger.info(f"[AUTO-DETECT] Method: {validation_method}, Device: {device_type}")
        
        # =====================================================================
        # STEP 3: LOAD CONFIGURATION (if not provided)
        # =====================================================================
        
        if not config:
            config = load_configuration(VALIDATION_RULES_FILE)
        
        if not config:
            logger.error("[AUTO-VALIDATE] No configuration loaded")
            return {
                "status": "ERROR",
                "message": "Configuration file not found or empty",
                "product_name": product_name
            }
        
        # =====================================================================
        # STEP 4: FIND PRODUCT-SPECIFIC CONFIG (NEW!)
        # =====================================================================
        
        validation_rules = config.get('validation_rules', {})
        config_key = find_product_config(product_name, product_code, device_type, validation_rules)
        
        if not config_key:
            logger.warning(f"[AUTO-VALIDATE] No config found for: {product_name}")
            return {
                "status": "ERROR",
                "product_name": product_name,
                "parent_class": parent_class,
                "is_orderable": is_orderable,
                "validation_method": validation_method,
                "device_type": device_type,
                "message": f"No configuration found for: {product_name}",
                "available_configs": list(validation_rules.keys())
            }
        
        # =====================================================================
        # STEP 5: LOAD CONFIGURATION
        # =====================================================================
        
        configured_attrs = validation_rules[config_key].get('attributes', [])
        logger.info(f"[AUTO-VALIDATE] Using config: {config_key}")
        logger.info(f"[AUTO-VALIDATE] Found {len(configured_attrs)} attributes in config")
        
        # =====================================================================
        # STEP 6: GET PRODUCT ATTRIBUTES FROM SALESFORCE
        # =====================================================================
        
        product_attrs_json = {}
        if check_salesforce and product:
            product_attrs_str = product.get('vlocity_cmt__JSONAttribute__c', '{}')
            
            if isinstance(product_attrs_str, str):
                try:
                    product_attrs_json = json.loads(product_attrs_str)
                except:
                    product_attrs_json = {}
            else:
                product_attrs_json = product_attrs_str
            
            logger.info(f"[SF QUERY] Retrieved product attributes from Salesforce")
        
        # =====================================================================
        # STEP 7: VALIDATE ATTRIBUTES
        # =====================================================================
        
        if not product:
            product = {}
        
        validation_result = validate_attributes(
            configured_attrs,
            product_attrs_json,
            product
        )
        
        # =====================================================================
        # STEP 8: BUILD RESPONSE
        # =====================================================================
        
        response = {
            "status": "SUCCESS",
            "validation": {
                "status": validation_result['status'],
                "product_name": product_name,
                "parent_class": parent_class,
                "is_orderable": is_orderable,
                "validation_method": validation_method,
                "device_type": device_type,
                "config_used": config_key,  # NEW: Shows which config was used
                "details": validation_result['details'],
                "timestamp": datetime.now().isoformat()
            }
        }
        
        # Add attributes to response
        if validation_result.get('present_attributes'):
            response['validation']['present_attributes'] = validation_result['present_attributes']
        
        if validation_result.get('missing_attributes'):
            response['validation']['missing_attributes'] = validation_result['missing_attributes']
        
        if validation_result.get('invalid_attributes'):
            response['validation']['invalid_attributes'] = validation_result['invalid_attributes']
        
        logger.info(f"[AUTO-VALIDATE] Validation complete: {validation_result['status']}")
        
        return response
    
    except Exception as e:
        logger.error(f"[AUTO-VALIDATE] Error: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        return {
            "status": "ERROR",
            "message": str(e),
            "product_name": product_name
        }


# ============================================================================
# FLASK ROUTES & BLUEPRINT REGISTRATION
# ============================================================================


def register_smart_auto_validator(flask_app, sf_client=None):
    """
    Register smart auto validator routes with a Flask app
    
    This function allows the validator to be integrated into an existing Flask application.
    
    Usage in main.py:
        from smart_validator_auto_detect import register_smart_auto_validator
        from salesforce_client import sf_login_from_config
        
        sf_client = sf_login_from_config()
        register_smart_auto_validator(app, sf_client)
    
    Usage in app.py:
        from smart_validator_auto_detect import register_smart_auto_validator
        app = Flask(__name__)
        register_smart_auto_validator(app)  # sf_client will auto-connect
    
    Args:
        flask_app: Flask application instance
        sf_client: Optional Salesforce client instance (if None, will auto-connect)
    """
    
    @flask_app.route('/api/validate-product', methods=['POST'])
    def validate_product_endpoint():
        """
        Flask endpoint to validate product
        
        Request JSON:
        {
            "product_name": "Account Level MPI"
        }
        
        Returns:
            Validation result JSON
        """
        try:
            data = request.get_json()
            product_name = data.get('product_name')
            
            if not product_name:
                return jsonify({
                    "status": "ERROR",
                    "message": "product_name is required"
                }), 400
            
            # Load configuration
            config = load_configuration(VALIDATION_RULES_FILE)
            
            # Use provided sf_client or auto-connect
            sf = sf_client if sf_client else get_salesforce_connection()
            
            # Validate product
            result = validate_product_auto(product_name, sf=sf, config=config)
            
            return jsonify(result), 200
        
        except Exception as e:
            logger.error(f"[ENDPOINT] Error: {str(e)}")
            return jsonify({
                "status": "ERROR",
                "message": str(e)
            }), 500
  
    @flask_app.route('/api/validate-product-manual', methods=['POST'])
    def validate_product_manual():
        """
        Manual validation without Salesforce
        
        Request JSON:
        {
            "product_name": "Account Level MPI",
            "attributes": {
                "ATT_B2B_Port_In_Promotion": "value1",
                "PR_B2C_ISApplicableForAria": "value2"
            }
        }
        """
        try:
            data = request.get_json()
            product_name = data.get('product_name')
            attributes = data.get('attributes', {})
            
            if not product_name:
                return jsonify({
                    "status": "ERROR",
                    "message": "product_name is required"
                }), 400
            
            # Convert attributes to Salesforce JSON format
            product_attrs_json = {
                "ATT_CAT_Product": [
                    {
                        "attributeuniquecode__c": code,
                        "value__c": value
                    }
                    for code, value in attributes.items()
                ]
            }
            
            # Load configuration
            config = load_configuration(VALIDATION_RULES_FILE)
            
            # Validate without Salesforce
            result = validate_product_auto(
                product_name,
                sf=None,
                config=config,
                check_salesforce=False
            )
            
            # Add manual attributes to validation
            if result.get('status') == 'SUCCESS':
                validation_rules = config.get('validation_rules', {})
                # Find product config
                auto_detect_result = auto_detect_validation_method({'Name': product_name})
                device_type = auto_detect_result[1]
                config_key = find_product_config(product_name, '', device_type, validation_rules)
                
                if config_key:
                    configured_attrs = validation_rules[config_key].get('attributes', [])
                    validation_result = validate_attributes(configured_attrs, product_attrs_json, {})
                    
                    result['validation']['status'] = validation_result['status']
                    result['validation']['details'] = validation_result['details']
                    if validation_result.get('present_attributes'):
                        result['validation']['present_attributes'] = validation_result['present_attributes']
                    if validation_result.get('invalid_attributes'):
                        result['validation']['invalid_attributes'] = validation_result['invalid_attributes']
                    if validation_result.get('missing_attributes'):
                        result['validation']['missing_attributes'] = validation_result['missing_attributes']
            
            return jsonify(result), 200
        
        except Exception as e:
            logger.error(f"[ENDPOINT] Error: {str(e)}")
            return jsonify({
                "status": "ERROR",
                "message": str(e)
            }), 500
    
    logger.info("[FLASK] Smart Auto Validator routes registered successfully")


# Create app instance for standalone mode
app = Flask(__name__)
register_smart_auto_validator(app)


# ============================================================================
# MAIN
# ============================================================================


if __name__ == '__main__':
    logger.info("=" * 80)
    logger.info("Smart Product Validator Starting")
    logger.info("=" * 80)
    
    # Load config to verify
    config = load_configuration(VALIDATION_RULES_FILE)
    if config:
        validation_rules = config.get('validation_rules', {})
        logger.info(f"Loaded {len(validation_rules)} validation rules")
        for rule_key in list(validation_rules.keys())[:5]:  # Show first 5
            logger.info(f"  - {rule_key}")
        if len(validation_rules) > 5:
            logger.info(f"  ... and {len(validation_rules) - 5} more")
    
    # Test Salesforce connection
    sf = get_salesforce_connection()
    if sf:
        logger.info("✓ Salesforce connection successful")
    else:
        logger.warning("✗ Salesforce connection failed (will operate in manual mode)")
    
    # Start Flask app
    logger.info("Starting Flask application on port 5000...")
    app.run(host='0.0.0.0', port=5000, debug=False)