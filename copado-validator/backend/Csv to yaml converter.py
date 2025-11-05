#!/usr/bin/env python3
"""
CSV to YAML Configuration Converter

Converts product configuration from CSV to YAML format.

Usage:
    python csv_to_yaml_converter.py product_config.csv validation_config_conditional.yaml

CSV Format:
    product_code,product_name,product_type,attribute_code,attribute_name,attribute_type,mandatory,allowed_values
    MPI,Account Level MPI,technical,ATT_B2B_Port_In_Promotion,Port In Promotion,text,true,
    SVC,Service XYZ,technical,ATT_SERVICE_ID,Service ID,text,true,
"""

import csv
import yaml
import sys
from collections import OrderedDict


def csv_to_yaml(csv_file, yaml_file):
    """
    Convert CSV configuration to YAML
    
    Args:
        csv_file: Path to input CSV file
        yaml_file: Path to output YAML file
    """
    
    config = {'validation_rules': OrderedDict()}
    products_processed = set()
    
    try:
        with open(csv_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            
            # Validate CSV headers
            expected_headers = {
                'product_code', 'product_name', 'product_type', 
                'attribute_code', 'attribute_name', 'attribute_type', 
                'mandatory', 'allowed_values'
            }
            
            if not reader.fieldnames:
                print("❌ ERROR: CSV file is empty")
                return False
            
            missing_headers = expected_headers - set(reader.fieldnames)
            if missing_headers:
                print(f"❌ ERROR: Missing CSV columns: {missing_headers}")
                return False
            
            print(f"✓ CSV Headers validated")
            
            # Process each row
            for row_num, row in enumerate(reader, start=2):
                try:
                    product_code = row['product_code'].strip()
                    product_name = row['product_name'].strip()
                    product_type = row['product_type'].strip()
                    attribute_code = row['attribute_code'].strip()
                    attribute_name = row['attribute_name'].strip()
                    attribute_type = row['attribute_type'].strip()
                    mandatory_str = row['mandatory'].strip().lower()
                    allowed_values_str = row['allowed_values'].strip()
                    
                    # Validate required fields
                    if not all([product_code, product_name, product_type, attribute_code, attribute_name, attribute_type]):
                        print(f"⚠ SKIP Row {row_num}: Missing required fields")
                        continue
                    
                    # Validate mandatory field
                    if mandatory_str not in ['true', 'false']:
                        print(f"⚠ SKIP Row {row_num}: Invalid mandatory value (must be true or false)")
                        continue
                    
                    # Validate attribute type
                    if attribute_type not in ['text', 'picklist']:
                        print(f"⚠ SKIP Row {row_num}: Invalid attribute_type (must be 'text' or 'picklist')")
                        continue
                    
                    # Create product config key
                    config_key = f"Product2_{product_type}_{product_code}"
                    
                    # Create product config if new
                    if config_key not in config['validation_rules']:
                        config['validation_rules'][config_key] = {
                            'product_type': product_type,
                            'product_code': product_code,
                            'product_name': product_name,
                            'description': product_name,
                            'attributes': []
                        }
                        products_processed.add(config_key)
                        print(f"✓ Product: {config_key}")
                    
                    # Parse allowed values (pipe-separated)
                    allowed_values = []
                    if allowed_values_str and attribute_type == 'picklist':
                        allowed_values = [v.strip() for v in allowed_values_str.split('|') if v.strip()]
                    
                    # Validate picklist has values
                    if attribute_type == 'picklist' and not allowed_values:
                        print(f"⚠ WARNING Row {row_num}: Picklist attribute has no allowed_values")
                    
                    # Create attribute
                    attribute = {
                        'code': attribute_code,
                        'name': attribute_name,
                        'type': attribute_type,
                        'mandatory': mandatory_str == 'true'
                    }
                    
                    # Add allowed_values if picklist
                    if attribute_type == 'picklist' and allowed_values:
                        attribute['allowed_values'] = allowed_values
                    
                    # Add attribute to product
                    config['validation_rules'][config_key]['attributes'].append(attribute)
                    print(f"  ├─ Attribute: {attribute_code} ({attribute_type})")
                
                except Exception as e:
                    print(f"❌ ERROR Row {row_num}: {str(e)}")
                    return False
        
        # Custom YAML representer for OrderedDict
        def represent_ordereddict(dumper, data):
            return dumper.represent_dict(data.items())
        
        yaml.add_representer(OrderedDict, represent_ordereddict)
        
        # Write YAML
        with open(yaml_file, 'w', encoding='utf-8') as f:
            yaml.dump(config, f, default_flow_style=False, sort_keys=False, allow_unicode=True)
        
        print(f"\n✅ SUCCESS!")
        print(f"   Input CSV: {csv_file}")
        print(f"   Output YAML: {yaml_file}")
        print(f"   Products processed: {len(products_processed)}")
        
        return True
    
    except FileNotFoundError:
        print(f"❌ ERROR: File not found: {csv_file}")
        return False
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
        return False


def main():
    """Main entry point"""
    
    if len(sys.argv) != 3:
        print(__doc__)
        print("Usage: python csv_to_yaml_converter.py <input.csv> <output.yaml>")
        sys.exit(1)
    
    csv_file = sys.argv[1]
    yaml_file = sys.argv[2]
    
    print("=" * 80)
    print("CSV to YAML Configuration Converter")
    print("=" * 80)
    print()
    
    success = csv_to_yaml(csv_file, yaml_file)
    
    if not success:
        sys.exit(1)


if __name__ == '__main__':
    main()