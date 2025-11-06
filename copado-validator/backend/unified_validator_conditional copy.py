# unified_validator_conditional.py
"""
CONDITIONAL VALIDATOR - Smart routing based on product properties

Flow:
1. Query Salesforce for product
2. Check: Is orderable? Is class "mobile device"?
3. If YES (Mobile Device + Orderable):
   → Call external script ONCE
   → Wait for CSV output
   → Return results
4. If NO (Other products like Line Product, Technical):
   → Use YAML configuration
   → Validate against configured attributes
   → Return results

POST /api/validate-components

Request:
{
    "device": "iPhone",
    "components": [
        {"type": "Product2", "name": "iPhone 15 Pro"}
    ]
}

Response:
For Mobile Device:
{
    "validation_method": "external_script",
    "csv_output": "..."
}

For Other Products:
{
    "validation_method": "yaml_config",
    "results": [...]
}
"""

from flask import Flask, request, jsonify
import logging
import yaml
import json
import subprocess
import csv
import io
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime

logger = logging.getLogger(__name__)


def load_validation_config(config_path: str = 'validation_config_conditional.yaml') -> Dict[str, Any]:
    """Load validation configuration"""
    try:
        with open(config_path, 'r') as f:
            config = yaml.safe_load(f)
        logger.info(f"Loaded validation config from {config_path}")
        return config
    except Exception as e:
        logger.error(f"Error loading config: {e}")
        return {}


def query_product_from_sf(sf, product_name: str) -> Optional[Dict[str, Any]]:
    """
    Query Salesforce for Product2
    
    Args:
        sf: Salesforce connection
        product_name: Product name
    
    Returns:
        Product record or None
    """
    try:
        safe_name = product_name.replace("'", "\\'")
        
        # FIXED: Removed 'AS' aliases - not supported in Salesforce SOQL
        soql = f"""
            SELECT 
                Id,
                Name,
                ProductCode,
                vlocity_cmt__ParentClassId__r.Name,
                vlocity_cmt__IsOrderable__c,
                vlocity_cmt__JSONAttribute__c,
                IsActive
            FROM Product2
            WHERE Name = '{safe_name}'
            AND IsActive = true
            LIMIT 1
        """
        
        logger.debug(f"[SF QUERY] Searching for Product2: {product_name}")
        response = sf.query(soql)
        records = response.get("records", [])
        
        if records:
            product = records[0]
            
            # DEBUG: Show what Salesforce returned
            logger.info(f"[SF QUERY] Raw response keys: {list(product.keys())}")
            logger.info(f"[SF QUERY] Raw vlocity_cmt__ParentClassId__r: {product.get('vlocity_cmt__ParentClassId__r')}")
            logger.info(f"[SF QUERY] Raw vlocity_cmt__IsOrderable__c: {product.get('vlocity_cmt__IsOrderable__c')}")
            
            # Map response fields to cleaner names for easier access
            # Since SOQL doesn't support AS aliases, we do it manually
            if 'vlocity_cmt__ParentClassId__r' in product:
                parent_class_obj = product['vlocity_cmt__ParentClassId__r']
                if parent_class_obj:
                    product['ParentClass'] = parent_class_obj.get('Name')
                else:
                    product['ParentClass'] = None
            else:
                product['ParentClass'] = None
            
            product['IsOrderable'] = product.get('vlocity_cmt__IsOrderable__c')
            product['JSONAttribute'] = product.get('vlocity_cmt__JSONAttribute__c')
            
            # DEBUG: Show what was mapped
            logger.info(f"[SF QUERY] MAPPED ParentClass: {product.get('ParentClass')}")
            logger.info(f"[SF QUERY] MAPPED IsOrderable: {product.get('IsOrderable')}")
            logger.info(f"[SF QUERY] MAPPED JSONAttribute exists: {bool(product.get('JSONAttribute'))}")
            
            logger.info(f"[SF QUERY] Found Product2: {product_name}")
            return product
        else:
            logger.warning(f"[SF QUERY] Product2 not found: {product_name}")
            return None
    
    except Exception as e:
        logger.error(f"[SF QUERY] Error querying Product2: {e}")
        return None


def is_mobile_device_orderable(product: Dict[str, Any]) -> bool:
    """
    Check if product is mobile device class and orderable
    
    Args:
        product: Product record from Salesforce
    
    Returns:
        True if mobile device + orderable, False otherwise
    """
    try:
        # Use mapped field names (from query_product_from_sf)
        parent_class = product.get("ParentClass", "").lower() if product.get("ParentClass") else ""
        is_orderable = product.get("IsOrderable", False)
        
        logger.info(f"[CHECK] Product dict keys: {list(product.keys())}")
        logger.info(f"[CHECK] Raw ParentClass value: {product.get('ParentClass')}")
        logger.info(f"[CHECK] Raw IsOrderable value: {product.get('IsOrderable')}")
        logger.info(f"[CHECK] Processed Parent Class: '{parent_class}', Orderable: {is_orderable}")
        
        # Check if mobile device class and orderable
        is_mobile = "mobile" in parent_class or "device" in parent_class
        
        logger.info(f"[CHECK] Is Mobile: {is_mobile}")
        
        if is_mobile and is_orderable:
            logger.info(f"[CHECK] ✓ Mobile Device + Orderable - Will call external script")
            return True
        else:
            logger.info(f"[CHECK] ✗ Not mobile device or not orderable - Will use YAML config")
            return False
    
    except Exception as e:
        logger.error(f"[CHECK] Error checking product type: {e}")
        return False


def call_external_script(product_name: str, product_id: str, json_data: str) -> Tuple[bool, Any]:
    """
    Call external validation script for mobile devices
    
    Args:
        product_name: Product name
        product_id: Product ID from SF
        json_data: JSON attributes
    
    Returns:
        Tuple of (success, csv_output_or_error)
    """
    try:
        # Script path - customize as needed
        script_path = "/path/to/validation_script.sh"  # or .py, .exe, etc
        
        logger.info(f"[SCRIPT] Calling external script for {product_name}")
        
        # Call external script
        # Pass product info as arguments
        result = subprocess.run(
            [script_path, product_id, product_name, json_data],
            capture_output=True,
            text=True,
            timeout=60  # 60 second timeout
        )
        
        if result.returncode == 0:
            logger.info(f"[SCRIPT] ✓ Script executed successfully")
            csv_output = result.stdout
            return True, csv_output
        else:
            error_msg = result.stderr
            logger.error(f"[SCRIPT] ✗ Script failed: {error_msg}")
            return False, error_msg
    
    except subprocess.TimeoutExpired:
        logger.error(f"[SCRIPT] Script execution timed out")
        return False, "Script execution timed out"
    except Exception as e:
        logger.error(f"[SCRIPT] Error calling external script: {e}")
        return False, str(e)


def parse_csv_output(csv_text: str) -> Dict[str, Any]:
    """
    Parse CSV output from external script
    
    Args:
        csv_text: CSV output text
    
    Returns:
        Parsed CSV as dict
    """
    try:
        # Parse CSV
        f = io.StringIO(csv_text)
        reader = csv.DictReader(f)
        rows = list(reader)
        
        logger.info(f"[CSV] Parsed {len(rows)} rows from CSV")
        
        return {
            "csv_rows": rows,
            "row_count": len(rows),
            "headers": reader.fieldnames if reader else []
        }
    
    except Exception as e:
        logger.error(f"[CSV] Error parsing CSV: {e}")
        return {
            "error": "Failed to parse CSV",
            "raw_output": csv_text
        }


def validate_with_yaml_config(product_name: str, product: Dict[str, Any], 
                              device: str, config: Dict) -> Dict[str, Any]:
    """
    Validate using YAML configuration (for non-mobile products)
    
    Args:
        product_name: Product name
        product: Product record from Salesforce
        device: Device type
        config: Validation configuration
    
    Returns:
        Validation result
    """
    try:
        logger.info(f"[YAML] Validating {product_name} using YAML config")
        
        # Get device config
        device_mapping = config.get('device_mapping', {})
        if device not in device_mapping:
            return {
                "status": "INVALID",
                "message": f"Device '{device}' not configured"
            }
        
        config_key = device_mapping[device].get('config_key')
        validation_rules = config.get('validation_rules', {})
        
        if config_key not in validation_rules:
            return {
                "status": "INVALID",
                "message": f"Config for {device} not found"
            }
        
        device_config = validation_rules[config_key]
        configured_attrs = device_config.get('required_attributes', [])
        
        # Get JSON attributes from product (use mapped field name)
        json_attr = product.get("JSONAttribute")
        
        if not json_attr:
            return {
                "status": "INVALID",
                "message": "Product has no JSON attributes configured"
            }
        
        # Compare attributes
        if isinstance(json_attr, str):
            actual_data = json.loads(json_attr)
        else:
            actual_data = json_attr
        
        actual_codes = [key for key in actual_data.keys() if key.startswith('ATT_')]
        
        present_attrs = []
        missing_attrs = []
        
        for config_attr in configured_attrs:
            attr_code = config_attr.get('code')
            if attr_code in actual_codes:
                present_attrs.append(config_attr)
            else:
                missing_attrs.append(config_attr)
        
        return {
            "status": "PARTIAL" if missing_attrs else "OK",
            "validation_type": "yaml_config",
            "details": {
                "device": device,
                "configured_count": len(configured_attrs),
                "present_count": len(present_attrs),
                "missing_count": len(missing_attrs)
            },
            "present_attributes": present_attrs,
            "missing_attributes": missing_attrs
        }
    
    except Exception as e:
        logger.error(f"[YAML] Validation error: {e}")
        return {
            "status": "ERROR",
            "message": f"Validation error: {str(e)}"
        }


def validate_component_conditional(sf, component: Dict[str, Any], device: str, config: Dict) -> Dict[str, Any]:
    """
    Validate component with conditional logic
    
    Args:
        sf: Salesforce connection
        component: Component dict
        device: Device type
        config: Validation configuration
    
    Returns:
        Validation result
    """
    comp_type = component.get("type", "").strip()
    comp_name = component.get("name", "").strip()
    
    if not comp_type or not comp_name:
        return {
            "component_type": comp_type or "UNKNOWN",
            "component_name": comp_name or "UNKNOWN",
            "status": "INVALID",
            "message": "Missing 'type' or 'name' field"
        }
    
    result = {
        "component_type": comp_type,
        "component_name": comp_name,
        "device": device
    }
    
    if comp_type.upper() != "PRODUCT2":
        result["status"] = "INVALID"
        result["message"] = "Only Product2 supported"
        return result
    
    # Query Salesforce
    product = query_product_from_sf(sf, comp_name)
    
    if not product:
        result["status"] = "INVALID"
        result["message"] = f"Product '{comp_name}' not found in Salesforce"
        return result
    
    # Check if mobile device + orderable
    if is_mobile_device_orderable(product):
        # CALL EXTERNAL SCRIPT
        logger.info(f"[ROUTE] Routing to EXTERNAL SCRIPT for {comp_name}")
        
        # Use mapped field name
        json_data = product.get("JSONAttribute", "")
        product_id = product.get("Id", "")
        
        success, output = call_external_script(comp_name, product_id, json_data)
        
        if success:
            csv_parsed = parse_csv_output(output)
            result.update({
                "validation_method": "external_script",
                "status": "OK",
                "script_executed": True,
                "csv_output": csv_parsed,
                "timestamp": datetime.utcnow().isoformat()
            })
        else:
            result.update({
                "validation_method": "external_script",
                "status": "ERROR",
                "script_executed": False,
                "error": output
            })
    
    else:
        # USE YAML CONFIG
        logger.info(f"[ROUTE] Routing to YAML CONFIG for {comp_name}")
        
        yaml_result = validate_with_yaml_config(comp_name, product, device, config)
        result.update(yaml_result)
        result["validation_method"] = "yaml_config"
    
    return result


def register_conditional_validator(app: Flask, sf=None, config: Dict = None):
    """
    Register conditional validator endpoint
    
    Args:
        app: Flask app
        sf: Salesforce connection
        config: Validation configuration
    """
    
    @app.route('/api/validate-components', methods=['POST'])
    def validate_components():
        """
        POST /api/validate-components
        
        Conditional validator - routes based on product type
        
        Request:
        {
            "device": "iPhone",
            "components": [{"type": "Product2", "name": "iPhone 15 Pro"}]
        }
        """
        try:
            data = request.get_json() or {}
            device = data.get("device", "").strip()
            components = data.get("components", [])
            
            if not device:
                return jsonify({
                    "error": "No device specified",
                    "message": "'device' field is required"
                }), 400
            
            if not isinstance(components, list) or not components:
                return jsonify({
                    "error": "No components provided",
                    "message": "Please provide at least one component"
                }), 400
            
            logger.info(f"[{device}] Validating {len(components)} component(s)")
            
            # Get SF connection
            try:
                if sf is None:
                    from salesforce_client import sf_login_from_config
                    sf_conn = sf_login_from_config()
                else:
                    sf_conn = sf
            except Exception as e:
                logger.error(f"SF connection failed: {e}")
                return jsonify({
                    "error": "Salesforce connection failed",
                    "details": str(e)
                }), 500
            
            # Load config
            cfg = config or load_validation_config()
            
            # Validate components
            results = []
            for comp in components:
                try:
                    result = validate_component_conditional(sf_conn, comp, device, cfg)
                    results.append(result)
                except Exception as e:
                    logger.error(f"Error validating component: {e}")
                    results.append({
                        "component_type": comp.get("type", "UNKNOWN"),
                        "component_name": comp.get("name", "UNKNOWN"),
                        "status": "ERROR",
                        "message": str(e)
                    })
            
            # Build response
            response = {
                "status": "SUCCESS",
                "device": device,
                "total": len(results),
                "results": results,
                "timestamp": datetime.utcnow().isoformat()
            }
            
            logger.info(f"[{device}] Validation complete")
            return jsonify(response), 200
        
        except Exception as e:
            logger.error(f"Unexpected error: {e}", exc_info=True)
            return jsonify({
                "error": "Validation failed",
                "details": str(e)
            }), 500


# ============================================================================
# EXAMPLE USAGE
# ============================================================================
"""
from flask import Flask
from unified_validator_conditional import register_conditional_validator
from salesforce_client import sf_login_from_config
import yaml

app = Flask(__name__)

sf = sf_login_from_config()

with open('validation_config_conditional.yaml', 'r') as f:
    config = yaml.safe_load(f)

register_conditional_validator(app, sf, config)

if __name__ == '__main__':
    app.run(debug=True)
"""

# ============================================================================
# CURL EXAMPLES
# ============================================================================
"""
# Mobile Device (calls external script)
curl -X POST http://localhost:5000/api/validate-components \
  -H "Content-Type: application/json" \
  -d '{
    "device": "iPhone",
    "components": [
      {"type": "Product2", "name": "iPhone 15 Pro"}
    ]
  }'

Response: External script output as CSV

# Non-Mobile Product (uses YAML config)
curl -X POST http://localhost:5000/api/validate-components \
  -H "Content-Type: application/json" \
  -d '{
    "device": "LineProduct",
    "components": [
      {"type": "Product2", "name": "Internet Plan"}
    ]
  }'

Response: YAML-based validation results
"""