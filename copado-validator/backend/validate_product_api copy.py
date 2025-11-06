#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
validate_product_api.py
- Validates a single product by name against catalog matrix
- Returns JSON response suitable for UI consumption
- Reuses validation logic from run_catalog_matrix_check.py
"""

import json
import re
import unicodedata
from collections import defaultdict
from typing import Dict, List, Set, Tuple, Any, Optional
from datetime import datetime

import pandas as pd

# =========================
# Normalization helpers
# =========================

_AT_PREFIX = re.compile(r"^\s*AT[\s'\-]*\s*", re.IGNORECASE)

def _ascii(s: str) -> str:
    return unicodedata.normalize("NFKC", s or "")

def _clean_spaces(s: str) -> str:
    return re.sub(r'\s+', ' ', s).strip()

def normalize_inches(s: str) -> str:
    if not s:
        return s
    s = _ascii(s)
    s = s.replace('\"', ' inch').replace('"', ' inch').replace('"', ' inch')
    s = s.replace("in.", " inch").replace("inches", " inch")
    s = re.sub(r'(?i)\b(\d+(?:\.\d+)?)\s*[\-–—]?\s*inch\b', r'\1 inch', s)
    return _clean_spaces(s)

def normalize_band(s: str) -> str:
    if not s:
        return s
    s = _ascii(s)
    s = re.sub(r'\s*[-–—]\s*', ' ', s)
    s = re.sub(r'\bM\s*/\s*L\b', 'ML', s, flags=re.IGNORECASE)
    s = re.sub(r'\bS\s*/\s*M\b', 'SM', s, flags=re.IGNORECASE)
    return _clean_spaces(s)

def normalize_color(s: str) -> str:
    if not s:
        return s
    s = _ascii(s)
    s = _AT_PREFIX.sub('', s)
    s = re.sub(r'(?i)\baluminium\b', 'Aluminum', s)
    s = s.replace("Starlight Aluminium", "Starlight Aluminum")
    s = s.replace("Silver Aluminium", "Silver Aluminum")
    return _clean_spaces(s)

def normalize_case_label(s: str) -> str:
    if not s:
        return s
    s = _ascii(s)
    s = _AT_PREFIX.sub('', s)
    s = re.sub(r'(?i)\baluminium\b', 'Aluminum', s)
    return _clean_spaces(s)

def normalize_value(attribute_code: str, catalog_type: str, raw: str) -> str:
    if raw is None:
        return ""
    key = (attribute_code or "").lower()
    val = str(raw)

    if "band" in key:
        return normalize_band(val)
    if "size" in key:
        return normalize_inches(val)
    if "case" in key:
        return normalize_case_label(val)
    if "color" in key:
        return normalize_color(val)
    return _clean_spaces(_ascii(val))

# =========================
# Applicability maps
# =========================

# Map Salesforce CatalogCode to APEX_ATTRS_BY_CATALOG keys
CATALOG_CODE_MAP: Dict[str, str] = {
    # Exact matches
    "PRB2C_Mobile_Phones_catalog": "phone",
    "Tablet": "tablet",
    "AppleWatch": "watch",
    
    # Case-insensitive variations
    "prb2c_mobile_phones_catalog": "phone",
    "tablet": "tablet",
    "applewatch": "watch",
    "apple watch": "watch",
    "ipad": "tablet",
    "iphone": "phone",
    "mobile": "phone",
    "phone": "phone",
}

def normalize_catalog_code(salesforce_catalog_code: str) -> str:
    """Map Salesforce CatalogCode to APEX_ATTRS_BY_CATALOG key
    
    Args:
        salesforce_catalog_code: e.g., "AppleWatch", "Tablet", "PRB2C_Mobile_Phones_catalog", "iPad"
        
    Returns:
        Normalized key: e.g., "watch", "tablet", "phone"
        Defaults to "phone" if no match found
    """
    if not salesforce_catalog_code:
        return "phone"
    
    # Try exact match first
    if salesforce_catalog_code in CATALOG_CODE_MAP:
        return CATALOG_CODE_MAP[salesforce_catalog_code]
    
    # Try case-insensitive match
    code_lower = salesforce_catalog_code.lower()
    if code_lower in CATALOG_CODE_MAP:
        return CATALOG_CODE_MAP[code_lower]
    
    # Try substring matching as fallback
    if "watch" in code_lower:
        return "watch"
    elif "ipad" in code_lower or "tablet" in code_lower:
        return "tablet"
    elif "iphone" in code_lower or "mobile" in code_lower or "phone" in code_lower:
        return "phone"
    
    # Default to phone if no match
    print(f"[NORMALIZE] ⚠️  Unknown CatalogCode '{salesforce_catalog_code}', defaulting to 'phone'")
    return "phone"

APPLICABLE_PICKLISTS: Dict[str, Set[str]] = {
    "phone":  {"Color", "PR_B2C_Mb_ATT_Capacity"},
    "tablet": {"PR_B2C_ATT_Size", "PR_B2C_Mb_ATT_Capacity", "Color"},
    "watch":  {"PR_B2C_ATT_Band_Type", "PR_B2C_Mb_ATT_Case", "PR_B2C_ATT_Size"},
}

APEX_ATTRS_BY_CATALOG: Dict[str, Set[str]] = {
    "phone": {
        "PR_B2C_Mb_ATT_IMEI",
        "PR_B2C_MB_ATT_InstallmentRemainingAmount",
        "PR_B2C_ATT_Installment_Invoiced",
        "PR_B2C_MB_ATT_InstallmentID",
        "PR_B2C_MB_ATT_Promotion_Amount",
        "PR_B2C_MB_ATT_Promotion_Amount_Per_Installment",
        "PR_B2C_MB_ATT_Promotion_Term",
        "PR_B2C_ATT_PromotionInvoiced",
        "PR_B2C_MB_ATT_Remaining_Promotion_Amount",
        "PR_B2C_MB_ATT_Promotion_Name",
        "PR_B2C_Mb_ATT_SKU",
        "PR_B2C_Mb_ATT_Model",
        "PR_B2C_ATT_Manufacturer",
        "PR_B2C_MB_ATT_Trade_In_Amount",
        "PR_B2C_MB_ATT_LTI_Id",
    },
    "tablet": {
        "PR_B2C_Mb_ATT_IMEI",
        "PR_B2C_MB_ATT_InstallmentRemainingAmount",
        "PR_B2C_ATT_Installment_Invoiced",
        "PR_B2C_MB_ATT_InstallmentID",
        "PR_B2C_MB_ATT_Promotion_Amount",
        "PR_B2C_MB_ATT_Promotion_Amount_Per_Installment",
        "PR_B2C_MB_ATT_Promotion_Term",
        "PR_B2C_ATT_PromotionInvoiced",
        "PR_B2C_MB_ATT_Remaining_Promotion_Amount",
        "PR_B2C_MB_ATT_Promotion_Name",
        "PR_B2C_Mb_ATT_SKU",
        "PR_B2C_Mb_ATT_Model",
        "PR_B2C_ATT_Manufacturer",
        "PR_B2C_MB_ATT_Trade_In_Amount",
        "PR_B2C_MB_ATT_LTI_Id",
    },
    "watch": {
        "PR_B2C_Mb_ATT_IMEI",
        "PR_B2C_MB_ATT_InstallmentRemainingAmount",
        "PR_B2C_ATT_Installment_Invoiced",
        "PR_B2C_MB_ATT_InstallmentID",
        "PR_B2C_MB_ATT_Promotion_Amount",
        "PR_B2C_MB_ATT_Promotion_Amount_Per_Installment",
        "PR_B2C_MB_ATT_Promotion_Term",
        "PR_B2C_ATT_PromotionInvoiced",
        "PR_B2C_MB_ATT_Remaining_Promotion_Amount",
        "PR_B2C_MB_ATT_Promotion_Name",
        "PR_B2C_Mb_ATT_SKU",
        "PR_B2C_Mb_ATT_Model",
        "PR_B2C_ATT_Manufacturer",
    },
}

APEX_DEFAULT_REQUIRED = {"PR_B2C_Mb_ATT_Model", "PR_B2C_ATT_Manufacturer"}

ATTR_FRIENDLY = {
    "Color": "Color",
    "PR_B2C_Mb_ATT_Capacity": "Capacity",
    "PR_B2C_ATT_Size": "Size",
    "PR_B2C_ATT_Band_Type": "Band",
    "PR_B2C_Mb_ATT_Case": "Case",
    "PR_B2C_Mb_ATT_IMEI": "IMEI",
    "PR_B2C_MB_ATT_InstallmentRemainingAmount": "InstallmentRemainingAmount",
    "PR_B2C_ATT_Installment_Invoiced": "Installment_Invoiced",
    "PR_B2C_MB_ATT_InstallmentID": "InstallmentID",
    "PR_B2C_MB_ATT_Promotion_Amount": "Promotion_Amount",
    "PR_B2C_MB_ATT_Promotion_Amount_Per_Installment": "Promotion_Amount_Per_Installment",
    "PR_B2C_MB_ATT_Promotion_Term": "Promotion_Term",
    "PR_B2C_ATT_PromotionInvoiced": "PromotionInvoiced",
    "PR_B2C_MB_ATT_Remaining_Promotion_Amount": "Remaining_Promotion_Amount",
    "PR_B2C_MB_ATT_Promotion_Name": "Promotion_Name",
    "PR_B2C_Mb_ATT_SKU": "SKU",
    "PR_B2C_Mb_ATT_Model": "Model",
    "PR_B2C_ATT_Manufacturer": "Manufacturer",
    "PR_B2C_MB_ATT_Trade_In_Amount": "Trade_In_Amount",
    "PR_B2C_MB_ATT_LTI_Id": "LTI_Id",
}

# =========================
# Helpers
# =========================

def _safe_json_loads(s: str) -> Any:
    if s is None:
        return {}
    s = s.strip()
    if not s:
        return {}
    try:
        return json.loads(s)
    except Exception:
        try:
            return json.loads(s.replace('""', '"'))
        except Exception:
            return {}

def _collect_matrix_options(device_details: list) -> list:
    """
    Extract matrix options from Device_Details list in CSV.
    
    Returns list of tuples: (product_code, catalog_type, allowed_values_map)
    where allowed_values_map = {attr_code: [values]}
    """
    results = []
    
    if not device_details:
        print(f"[COLLECT_OPTIONS] device_details is empty or None")
        return results
    
    if not isinstance(device_details, list):
        print(f"[COLLECT_OPTIONS] device_details is not list, converting from {type(device_details)}")
        device_details = [device_details]
    
    print(f"[COLLECT_OPTIONS] Processing {len(device_details)} devices")
    
    for idx, device in enumerate(device_details):
        if not isinstance(device, dict):
            print(f"[COLLECT_OPTIONS] Device {idx} is not dict: {type(device)}")
            continue
        
        print(f"[COLLECT_OPTIONS] Device {idx} keys: {list(device.keys())}")
        
        product_code = device.get("ProductCode")
        catalog_type = device.get("CatalogType")
        
        print(f"[COLLECT_OPTIONS] Device {idx}: ProductCode={product_code}, CatalogType={catalog_type}")
        
        if not product_code or not catalog_type:
            print(f"[COLLECT_OPTIONS] ⚠️  Device {idx} missing ProductCode or CatalogType")
            continue
        
        # Extract all attributes and their values
        allowed_map = {}
        
        # Get all keys that might be attributes
        for key, value in device.items():
            if key in ("ProductCode", "CatalogType", "DeviceName"):
                continue
            
            # This key is an attribute code
            if value and isinstance(value, list):
                allowed_map[key] = value
                print(f"[COLLECT_OPTIONS]   {key}: {value}")
            elif value:
                allowed_map[key] = [value]
                print(f"[COLLECT_OPTIONS]   {key}: [{value}]")
        
        if allowed_map:
            results.append((product_code, catalog_type, allowed_map))
            print(f"[COLLECT_OPTIONS] ✅ Device {idx} added with {len(allowed_map)} attributes")
        else:
            print(f"[COLLECT_OPTIONS] ⚠️  Device {idx} has no attributes")
    
    print(f"[COLLECT_OPTIONS] Total devices processed: {len(results)}")
    return results

def find_attribute_nodes(product_attr_json: dict, attr_code: str) -> List[dict]:
    nodes = []
    for _, lst in (product_attr_json or {}).items():
        if not isinstance(lst, list):
            continue
        for item in lst:
            if not isinstance(item, dict):
                continue
            if (item.get("attributeuniquecode__c") or "").strip() == attr_code:
                nodes.append(item)
    return nodes

def attribute_present(product_attr_json: dict, attr_code: str) -> bool:
    return len(find_attribute_nodes(product_attr_json, attr_code)) > 0

def picklist_values_from_product(product_attr_json: dict, attr_code: str) -> Set[str]:
    values: Set[str] = set()
    for node in find_attribute_nodes(product_attr_json, attr_code):
        rt = node.get("attributeRunTimeInfo") or {}
        v_list = rt.get("values") or []
        if isinstance(v_list, list):
            for d in v_list:
                if isinstance(d, dict):
                    val = d.get("value")
                else:
                    val = d if isinstance(d, str) else None
                if val:
                    values.add(str(val))
    return values

def apex_has_default_or_value(node: dict) -> bool:
    rt = node.get("attributeRunTimeInfo") or {}
    default = rt.get("default")
    if isinstance(default, list):
        if any(bool((x.get("value") if isinstance(x, dict) else x)) for x in default):
            return True
    elif isinstance(default, (str, int, float)) and str(default).strip():
        return True

    val = node.get("value__c")
    if val is not None and str(val).strip():
        return True
    return False

# =========================
# Salesforce fetch
# =========================

def sf_fetch_product_by_name(sf, product_name: str) -> Optional[Tuple[str, str, str, dict]]:
    """
    Fetch a single product by name across ALL catalogs in one query.
    Returns: (product_code, catalog_code, catalog_type, product_attr_json) or None
    
    Uses product name to search, then determines catalog from result.
    No need to loop through catalogs - all in one query!
    """
    print(f"\n[SF_FETCH] Starting fetch for product: {product_name}")
    print(f"[SF_FETCH] SF client: {sf}")
    print(f"[SF_FETCH] SF client type: {type(sf)}")
    
    if sf is None:
        print("[SF_FETCH] ❌ ERROR: SF client is None!")
        return None
    
    q = f"""
SELECT Id, 
       vlocity_cmt__Product2Id__r.ProductCode,
       vlocity_cmt__CatalogId__r.vlocity_cmt__CatalogCode__c,
       vlocity_cmt__Product2Id__r.Name,
       vlocity_cmt__Product2Id__r.vlocity_cmt__JSONAttribute__c,
       vlocity_cmt__Product2Id__r.vlocity_cmt__IsOrderable__c
FROM vlocity_cmt__CatalogProductRelationship__c
WHERE vlocity_cmt__Product2Id__r.Name = '{product_name}'
  AND vlocity_cmt__Product2Id__r.IsActive = true
  AND vlocity_cmt__Product2Id__r.vlocity_cmt__IsOrderable__c = true
LIMIT 1
"""
    
    print(f"[SF_FETCH] Query:\n{q}")
    
    try:
        print("[SF_FETCH] Executing query...")
        res = sf.query_all(q)
        print(f"[SF_FETCH] Query response type: {type(res)}")
        print(f"[SF_FETCH] Query response keys: {res.keys() if isinstance(res, dict) else 'N/A'}")
        
        records = res.get("records", [])
        print(f"[SF_FETCH] Records found: {len(records)}")
        
        if not records:
            print(f"[SF_FETCH] ❌ No records found for product: {product_name}")
            return None
        
        r = records[0]
        print(f"[SF_FETCH] First record keys: {r.keys()}")
        print(f"[SF_FETCH] Full record structure:")
        print(f"[SF_FETCH]   {json.dumps(r, indent=2, default=str)}")
        
        pcode = r.get("vlocity_cmt__Product2Id__r", {}).get("ProductCode")
        raw = r.get("vlocity_cmt__Product2Id__r", {}).get("vlocity_cmt__JSONAttribute__c")
        
        # Get the nested CatalogId structure
        catalog_id_obj = r.get("vlocity_cmt__CatalogId__r", {})
        print(f"[SF_FETCH] Catalog ID Object: {catalog_id_obj}")
        print(f"[SF_FETCH] Catalog ID Object type: {type(catalog_id_obj)}")
        print(f"[SF_FETCH] Catalog ID Object keys: {catalog_id_obj.keys() if isinstance(catalog_id_obj, dict) else 'N/A'}")
        
        catalog_code = catalog_id_obj.get("vlocity_cmt__CatalogCode__c")
        
        print(f"[SF_FETCH] Product Code: {pcode}")
        print(f"[SF_FETCH] Catalog Code (raw): {catalog_code!r}")
        print(f"[SF_FETCH] Catalog Code (type): {type(catalog_code)}")
        print(f"[SF_FETCH] Has JSON Attributes: {raw is not None}")
        
        # Determine catalog type from catalog code using our mapping
        ctype = normalize_catalog_code(catalog_code) if catalog_code else "phone"
        
        print(f"[SF_FETCH] Catalog Type (normalized from {catalog_code}): {ctype}")
        
        j = _safe_json_loads(raw or "")
        print(f"[SF_FETCH] ✅ Successfully fetched product")
        return (pcode, catalog_code, ctype, j if isinstance(j, dict) else {})
    
    except Exception as e:
        print(f"[SF_FETCH] ❌ ERROR: {e}")
        print(f"[SF_FETCH] Exception type: {type(e).__name__}")
        import traceback
        traceback.print_exc()
        return None

# =========================
# Validation
# =========================

def validate_picklists_for_product(
    product_code: str,
    catalog_type: str,
    product_attr_json: dict,
    matrix_rows: pd.DataFrame
) -> Tuple[List[dict], List[dict], List[dict]]:
    """
    Validate picklists. Returns (invalid_list, skipped_list, present_list)
    """
    invalid = []
    skipped = []
    present = []
    
    # Handle None or empty matrix
    if matrix_rows is None or matrix_rows.empty:
        print(f"[PICKLIST] ❌ matrix_rows is None or empty")
        return invalid, skipped, present
    
    print(f"\n[PICKLIST] ========== Starting picklist validation ==========")
    print(f"[PICKLIST] product_code: {product_code}")
    print(f"[PICKLIST] catalog_type: {catalog_type}")
    print(f"[PICKLIST] matrix_rows shape: {matrix_rows.shape}")
    
    # Normalize catalog_type to match APPLICABLE_PICKLISTS keys
    normalized_catalog = normalize_catalog_code(catalog_type)
    applicable = APPLICABLE_PICKLISTS.get(normalized_catalog, set())
    print(f"[PICKLIST] Applicable attributes for {catalog_type} (normalized: {normalized_catalog}): {applicable}")
    
    # Filter by product code
    mrows = matrix_rows[matrix_rows["ProductCode"] == product_code]
    print(f"[PICKLIST] ✅ Rows matching product_code '{product_code}': {len(mrows)}")
    
    if len(mrows) == 0:
        print(f"[PICKLIST] ⚠️  No matrix rows found for product: {product_code}")
        return invalid, skipped, present
    
    print(f"[PICKLIST] Sample rows for this product:")
    for idx, row in mrows.head(3).iterrows():
        print(f"[PICKLIST]   - {row['AttributeCode']}: {row['MatrixValues']}")

    for _, rec in mrows.iterrows():
        attr_code = rec["AttributeCode"]
        attr_name = ATTR_FRIENDLY.get(attr_code, attr_code)
        matrix_vals_raw = rec["MatrixValues"] or []

        if attr_code not in applicable:
            skipped.append({
                "code": attr_code,
                "name": attr_name,
                "type": "picklist",
                "reason": "Not applicable for this catalog",
                "group": "MATRIX"
            })
            continue

        if not attribute_present(product_attr_json, attr_code):
            invalid.append({
                "code": attr_code,
                "name": attr_name,
                "type": "picklist",
                "current_value": None,
                "allowed_values": matrix_vals_raw,
                "error": "Attribute missing on product",
                "mandatory": False,
                "group": "MATRIX"
            })
            continue

        product_allowed_raw = picklist_values_from_product(product_attr_json, attr_code)
        
        matrix_norm = {normalize_value(attr_code, catalog_type, v) for v in matrix_vals_raw}
        product_norm = {normalize_value(attr_code, catalog_type, v) for v in product_allowed_raw}
        
        missing = sorted([v for v in matrix_norm if v not in product_norm])

        if missing:
            invalid.append({
                "code": attr_code,
                "name": attr_name,
                "type": "picklist",
                "current_value": list(product_norm) if product_norm else [],
                "allowed_values": sorted(matrix_norm),
                "error": f"Matrix options missing on product: {', '.join(missing)}",
                "mandatory": False,
                "group": "MATRIX"
            })
        else:
            # ✅ Picklist is valid - add to present
            print(f"[PICKLIST] ✅ {attr_code} is valid")
            present.append({
                "code": attr_code,
                "name": attr_name,
                "type": "picklist",
                "current_value": list(product_norm) if product_norm else [],
                "allowed_values": sorted(matrix_norm),
                "mandatory": False,
                "group": "MATRIX"
            })

    print(f"[PICKLIST] Summary - Invalid: {len(invalid)}, Present: {len(present)}, Skipped: {len(skipped)}")
    return invalid, skipped, present

def validate_apex_for_product(
    product_code: str,
    catalog_type: str,
    product_attr_json: dict
) -> Tuple[List[dict], List[dict]]:
    """
    Validate APEX attributes. Returns (invalid_list, present_list)
    """
    invalid = []
    present = []
    
    # Normalize catalog_type to match APEX_ATTRS_BY_CATALOG keys
    normalized_catalog = normalize_catalog_code(catalog_type)
    apex_set = APEX_ATTRS_BY_CATALOG.get(normalized_catalog, set())
    
    if not apex_set:
        return invalid, present

    for attr_code in sorted(apex_set):
        attr_name = ATTR_FRIENDLY.get(attr_code, attr_code)
        nodes = find_attribute_nodes(product_attr_json, attr_code)

        if not nodes:
            invalid.append({
                "code": attr_code,
                "name": attr_name,
                "type": "apex",
                "current_value": None,
                "error": "APEX attribute missing on product",
                "mandatory": attr_code in APEX_DEFAULT_REQUIRED,
                "group": "APEX"
            })
            continue

        # If default/value is required
        if attr_code in APEX_DEFAULT_REQUIRED:
            has_any_default = any(apex_has_default_or_value(n) for n in nodes)
            if not has_any_default:
                invalid.append({
                    "code": attr_code,
                    "name": attr_name,
                    "type": "apex",
                    "current_value": None,
                    "error": "APEX attribute present but missing default/value",
                    "mandatory": True,
                    "group": "APEX"
                })
                continue

        # Present and OK
        present.append({
            "code": attr_code,
            "name": attr_name,
            "type": "apex",
            "current_value": "Configured",
            "mandatory": attr_code in APEX_DEFAULT_REQUIRED,
            "group": "APEX"
        })

    return invalid, present

# =========================
# Main API function
# =========================

def validate_product_by_name(
    sf,
    product_name: str,
    matrix_df: pd.DataFrame,
    config_used: str = ""
) -> Dict[str, Any]:
    """
    Main function to validate a single product.
    
    Args:
        sf: Salesforce connection
        product_name: Name of product to validate
        matrix_df: Parsed matrix DataFrame
        config_used: Optional config name to include in response
        
    Returns:
        JSON-serializable dict with validation results
    """
    print(f"\n[VALIDATE] ========== Starting validate_product_by_name ==========")
    print(f"[VALIDATE] product_name: {product_name}")
    print(f"[VALIDATE] matrix_df type: {type(matrix_df)}")
    print(f"[VALIDATE] matrix_df is None: {matrix_df is None}")
    
    # CRITICAL: Check if matrix_df is None before proceeding
    if matrix_df is None:
        print(f"[VALIDATE] ❌ CRITICAL ERROR: matrix_df is None!")
        print(f"[VALIDATE] This means Matrix CSV failed to load in app.py init_globals()")
        timestamp = datetime.utcnow().isoformat() + "Z"
        return {
            "status": "FAILED",
            "validation": {
                "product_name": product_name,
                "timestamp": timestamp,
                "error": "Matrix CSV not loaded. Check MATRIX_CSV_PATH and logs."
            }
        }
    
    if matrix_df is not None:
        print(f"[VALIDATE] matrix_df shape: {matrix_df.shape}")
        print(f"[VALIDATE] matrix_df columns: {list(matrix_df.columns)}")
    
    timestamp = datetime.utcnow().isoformat() + "Z"
    
    # Fetch product by name (searches across all catalogs)
    product_data = sf_fetch_product_by_name(sf, product_name)
    
    if not product_data:
        return {
            "status": "FAILED",
            "validation": {
                "product_name": product_name,
                "config_used": config_used or "auto-detect",
                "timestamp": timestamp,
                "error": f"Product '{product_name}' not found or not orderable"
            }
        }
    
    product_code, catalog_code, catalog_type, product_attr_json = product_data
    
    # Validate
    invalid_picklists, skipped_picklists, present_picklists = validate_picklists_for_product(
        product_code, catalog_type, product_attr_json, matrix_df
    )
    invalid_apex, present_apex = validate_apex_for_product(
        product_code, catalog_type, product_attr_json
    )
    
    # Combine results - picklists and APEX
    all_invalid = invalid_picklists + invalid_apex
    all_present = present_picklists + present_apex  # ✅ Include both picklists AND apex
    all_skipped = skipped_picklists
    
    # Calculate counts
    configured_count = len(all_invalid) + len(all_present) + len(all_skipped)
    invalid_count = len(all_invalid)
    present_count = len(all_present)
    missing_count = len(all_skipped)
    
    # Determine overall status
    if invalid_count == 0 and missing_count == 0:
        overall_status = "SUCCESS"
    elif invalid_count == 0:
        overall_status = "PARTIAL"
    else:
        overall_status = "PARTIAL" if missing_count == 0 else "PARTIAL"
    
    return {
        "status": overall_status,
        "validation": {
            "product_name": product_name,
            "product_code": product_code,
            "catalog_code": catalog_code,
            "config_used": config_used or catalog_code,
            "timestamp": timestamp,
            "details": {
                "configured_count": configured_count,
                "present_count": present_count,
                "invalid_count": invalid_count,
                "missing_count": missing_count
            },
            "is_orderable": True,
            "device_type": catalog_type.title(),
            "parent_class": "Mobile Line Class",
            "status": overall_status,
            "invalid_attributes": all_invalid,
            "present_attributes": all_present,
            "missing_attributes": all_skipped
        }
    }

if __name__ == "__main__":
    print("This module should be imported by Flask app or other consumers")