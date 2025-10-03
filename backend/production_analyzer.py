"""
Production State Analyzer
Compares deployment against production to detect regressions
"""

import pandas as pd
from datetime import datetime
from typing import Dict, Optional


def parse_production_state(file_path: str) -> Dict:
    """
    Parse production CSV and index by component
    
    Returns:
        Dict mapping component_name -> production_info
    """
    df = pd.read_csv(file_path)
    df.columns = df.columns.str.strip()
    
    prod_state = {}
    
    for _, row in df.iterrows():
        component_name = str(row.get('copado__Metadata_API_Name__c', '')).strip()
        if not component_name or component_name == 'nan':
            continue
        
        commit_date_str = row.get('copado__Last_Commit_Date__c')
        commit_date = None
        
        if pd.notna(commit_date_str):
            try:
                commit_date = pd.to_datetime(commit_date_str)
            except:
                pass
        
        # If component appears multiple times, keep latest
        if component_name in prod_state:
            existing_date = prod_state[component_name]['last_commit_date']
            if commit_date and existing_date and commit_date > existing_date:
                prod_state[component_name]['last_commit_date'] = commit_date
        else:
            prod_state[component_name] = {
                'last_commit_date': commit_date,
                'type': str(row.get('copado__Type__c', 'Unknown')),
                'last_modified_by': str(row.get('LastModifiedBy.Name', 'Unknown')),
                'exists_in_prod': True
            }
    
    return prod_state


def check_regression(deploy_component, prod_state: Optional[Dict]) -> Optional[Dict]:
    """
    Check if deployment component would regress production
    
    Returns:
        Regression info dict or None if safe
    """
    if not prod_state:
        return None
    
    component_name = deploy_component.api_name
    
    # Component not in production - safe (new component)
    if component_name not in prod_state:
        return {
            'is_regression': False,
            'is_new': True,
            'message': 'New component - not in production yet'
        }
    
    prod_info = prod_state[component_name]
    prod_date = prod_info['last_commit_date']
    deploy_date = deploy_component.last_commit_date
    
    # Can't determine if no dates
    if not prod_date or not deploy_date:
        return None
    
    # Deployment is older than production
    if deploy_date < prod_date:
        days_behind = (prod_date - deploy_date).days
        return {
            'is_regression': True,
            'is_new': False,
            'days_behind': days_behind,
            'prod_date': prod_date.isoformat(),
            'deploy_date': deploy_date.isoformat(),
            'prod_modified_by': prod_info['last_modified_by'],
            'message': f'REGRESSION: Deploy is {days_behind} days older than production',
            'severity': 'CRITICAL' if days_behind > 7 else 'WARNING'
        }
    
    # Deployment is newer - safe
    return {
        'is_regression': False,
        'is_new': False,
        'days_ahead': (deploy_date - prod_date).days,
        'message': 'Safe - newer than production'
    }