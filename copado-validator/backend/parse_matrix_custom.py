#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
parse_matrix_simple.py

Simple direct CSV parser - NO filtering, NO Family requirement.
Extract ALL products from CSV.

Structure: Flat by ProductCode (unique key)

For each product:
- Get ProductCode from Device_Details (required)
- Extract ALL attributes from Pricing_Details and SKU_details
- Map attributes to codes (Color, Size, Capacity, Case, Band, etc.)
- Output: ProductCode → Attributes

Note: Family field is NOT used. We extract all products regardless.
Catalog type is guessed from attributes for summary purposes only.

Usage:
  python parse_matrix_simple.py --input data.csv --output matrix.yaml
  
Then in app:
  1. Query Salesforce for ProductCode and CatalogCode
  2. Search YAML: products[ProductCode] → get matrix values
  3. Validate against APEX_ATTRS_BY_CATALOG[CatalogCode]
"""

import csv
import json
import yaml
from collections import defaultdict
import sys

def safe_json_loads(s):
    """Safely parse JSON"""
    if s is None or not isinstance(s, str):
        return {}
    s = s.strip()
    if not s:
        return {}
    try:
        return json.loads(s)
    except Exception as e:
        print(f"❌ JSON parse error: {e}")
        return {}

def find_json_column(headers):
    """Find which column has the JSON data"""
    for h in headers:
        hh = (h or "").strip().lower()
        if hh in ("sku details", "sku_details", "json", "payload"):
            return h
    return None

def guess_catalog_from_attributes(attribute_values):
    """Guess catalog type from attributes (optional, for reference only)
    
    This is NOT used for filtering. We extract all products.
    This is just for organizing the summary output.
    """
    # Check what attributes we have
    attr_codes = set(attribute_values.keys())
    
    if "PR_B2C_ATT_Band_Type" in attr_codes or "PR_B2C_Mb_ATT_Case" in attr_codes:
        return "AppleWatch"
    elif "PR_B2C_ATT_Size" in attr_codes and "PR_B2C_Mb_ATT_Capacity" in attr_codes:
        return "Tablet"
    elif "PR_B2C_Mb_ATT_Capacity" in attr_codes:
        return "PRB2C_Mobile_Phones_catalog"
    else:
        return "Unknown"

def map_attribute_code(attribute_name):
    """Map attribute names to codes - try all mappings
    
    Since we don't know which catalog a product belongs to,
    we try mapping against all known mappings.
    """
    
    all_mappings = {
        "PRB2C_Mobile_Phones_catalog": {
            "Color": "Color",
            "Capacity": "PR_B2C_Mb_ATT_Capacity",
        },
        "Tablet": {
            "Size": "PR_B2C_ATT_Size",
            "Capacity": "PR_B2C_Mb_ATT_Capacity",
            "Color": "Color",
        },
        "AppleWatch": {
            "Size": "PR_B2C_ATT_Size",
            "Case": "PR_B2C_Mb_ATT_Case",
            "Band": "PR_B2C_ATT_Band_Type",
        },
    }
    
    # Try to find mapping in any catalog
    for catalog_mapping in all_mappings.values():
        if attribute_name in catalog_mapping:
            return catalog_mapping[attribute_name]
    
    # Not found in any mapping
    return None

def parse_csv(csv_path):
    """Parse CSV - extract what's there, no logic"""
    print(f"\n📖 Reading CSV: {csv_path}")
    
    matrix_data = defaultdict(lambda: defaultdict(list))
    
    with open(csv_path, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        
        if not reader.fieldnames:
            print("❌ CSV has no headers!")
            return None
        
        print(f"✅ CSV columns: {reader.fieldnames}")
        
        # Find JSON column
        json_col = find_json_column(reader.fieldnames)
        if not json_col:
            print(f"❌ No JSON column found!")
            print(f"   Available: {reader.fieldnames}")
            return None
        
        print(f"✅ Found JSON column: '{json_col}'")
        
        row_count = 0
        items_count = 0
        skipped_rows = 0
        
        for row in reader:
            row_count += 1
            raw_json = row.get(json_col, "").strip()
            
            if row_count % 20 == 0:
                print(f"   Processing row {row_count}...")
            
            if not raw_json:
                skipped_rows += 1
                continue
            
            # Parse JSON
            j = safe_json_loads(raw_json)
            
            # Skip if it's just a list (reference row)
            if isinstance(j, list):
                skipped_rows += 1
                continue
            
            if not isinstance(j, dict):
                skipped_rows += 1
                continue
            
            # Get Device_Details
            device_details = j.get("Device_Details", [])
            
            if not device_details or not isinstance(device_details, list):
                skipped_rows += 1
                continue
            
            # Process each device
            for device in device_details:
                if not isinstance(device, dict):
                    continue
                
                product_code = device.get("ProductCode")
                
                if not product_code:
                    continue
                
                # Extract attributes from Pricing_Details
                pricing_details = device.get("Pricing_Details", [])
                
                if not pricing_details or not isinstance(pricing_details, list):
                    continue
                
                # Collect all attribute values
                attribute_values = defaultdict(set)
                
                for pricing in pricing_details:
                    if not isinstance(pricing, dict):
                        continue
                    
                    # Go through all keys in pricing
                    for key, value in pricing.items():
                        # Skip system fields
                        if key in ("Total_price", "Installment_Months", "Next_Up", "SKU_details"):
                            continue
                        
                        # Check if this attribute should be included
                        mapped_code = map_attribute_code(key)
                        
                        if not mapped_code:
                            # Attribute not applicable
                            continue
                        
                        # Add value
                        if isinstance(value, list):
                            for v in value:
                                if v and v.lower() != "na":
                                    attribute_values[mapped_code].add(v)
                        elif value and value.lower() != "na":
                            attribute_values[mapped_code].add(value)
                    
                    # Handle Color and Band from SKU_details
                    sku_details = pricing.get("SKU_details", [])
                    if isinstance(sku_details, dict):
                        sku_details = [sku_details]
                    
                    if isinstance(sku_details, list):
                        for sku in sku_details:
                            if isinstance(sku, dict):
                                # Extract Color
                                color = sku.get("Color")
                                mapped_code = map_attribute_code("Color")
                                if color and color.lower() != "na" and mapped_code:
                                    attribute_values[mapped_code].add(color)
                                
                                # Extract Band
                                band = sku.get("Band")
                                if band and band.lower() != "na":
                                    mapped_code = map_attribute_code("Band")
                                    if mapped_code:
                                        attribute_values[mapped_code].add(band)
                
                # Add to matrix_data
                if attribute_values:
                    # Guess catalog for summary purposes only
                    guessed_catalog = guess_catalog_from_attributes(attribute_values)
                    
                    for mapped_code, values in attribute_values.items():
                        matrix_data[guessed_catalog][product_code].append({
                            "attribute": mapped_code,
                            "values": sorted(list(values))
                        })
                        items_count += 1
        
        print(f"✅ Processed {row_count} CSV rows")
        print(f"✅ Extracted {items_count} attributes")
        if skipped_rows > 0:
            print(f"⚠️  Skipped rows: {skipped_rows}")
    
    return dict(matrix_data)

def save_to_yaml(data, output_path):
    """Save parsed data to YAML - flattened by ProductCode"""
    print(f"\n💾 Saving to YAML: {output_path}")
    
    # Flatten the structure: all products by ProductCode (no catalog nesting)
    flat_products = {}
    
    for catalog_type, products in data.items():
        for product_code, attrs in products.items():
            flat_products[product_code] = attrs
    
    yaml_data = {
        "products": flat_products,
        "metadata": {
            "total_products": len(flat_products),
            "total_attributes": sum(sum(len(attrs) for attrs in products.values()) for products in data.values())
        }
    }
    
    with open(output_path, 'w') as f:
        yaml.dump(yaml_data, f, default_flow_style=False, sort_keys=False, allow_unicode=True)
    
    print(f"✅ Saved to {output_path}")

def display_summary(data):
    """Display summary of parsed data"""
    print(f"\n📊 Summary:")
    
    total_products = 0
    total_attrs = 0
    
    for catalog_type in sorted(data.keys()):
        products = data[catalog_type]
        total_products += len(products)
        
        for attrs in products.values():
            total_attrs += len(attrs)
    
    print(f"   Total products: {total_products}")
    print(f"   Total attributes: {total_attrs}")
    
    for catalog_type in sorted(data.keys()):
        products = data[catalog_type]
        catalog_attrs = sum(len(attrs) for attrs in products.values())
        
        print(f"\n   {catalog_type}:")
        print(f"     Products: {len(products)}")
        print(f"     Total attributes: {catalog_attrs}")
        
        # Show sample product
        for product_code, attrs in sorted(products.items())[:1]:
            print(f"\n     Sample: {product_code}")
            for attr in attrs[:3]:
                values = attr['values']
                if len(values) <= 2:
                    print(f"       - {attr['attribute']}: {values}")
                else:
                    print(f"       - {attr['attribute']}: {values[:2]} ... ({len(values)} total)")
            if len(attrs) > 3:
                print(f"       ... and {len(attrs)-3} more attributes")

def main():
    import argparse
    
    parser = argparse.ArgumentParser(description='Convert matrix CSV to YAML (simple direct parser)')
    parser.add_argument('--input', required=True, help='Input CSV file')
    parser.add_argument('--output', default='matrix.yaml', help='Output YAML file')
    
    args = parser.parse_args()
    
    print("=" * 60)
    print("MATRIX CSV TO YAML - SIMPLE DIRECT PARSER")
    print("=" * 60)
    
    # Parse CSV
    data = parse_csv(args.input)
    
    if not data:
        print("❌ Failed to parse CSV or no data extracted")
        sys.exit(1)
    
    # Save to YAML
    save_to_yaml(data, args.output)
    
    # Display summary
    display_summary(data)
    
    print("\n" + "=" * 60)
    print("✅ SUCCESS!")
    print("=" * 60)
    print(f"\nNow use this YAML file with app_yaml.py:")
    print(f"\n  export MATRIX_YAML_PATH='{args.output}'")
    print(f"  python app_yaml.py")

if __name__ == "__main__":
    main()