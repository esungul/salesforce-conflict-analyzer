# sf_adapter.py
from __future__ import annotations
from typing import Dict, List, Any

def _get(d: Dict[str, Any], *path: str):
    cur = d
    for p in path:
        if cur is None:
            return None
        cur = cur.get(p)
    return cur

def sf_records_to_rows(records: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Transform Salesforce API records from copado__User_Story_Metadata__c to the same
    key shape our CSV parser expects. This is a stub-friendly version;
    fields are mapped 1:1 when present.
    """
    rows: List[Dict[str, Any]] = []
    for r in records:
        rows.append({
            "copado__User_Story__r.Name": _get(r, "copado__User_Story__r", "Name"),
            "copado__User_Story__r.copado__User_Story_Title__c": _get(r, "copado__User_Story__r", "copado__User_Story_Title__c"),
            "copado__User_Story__r.copado__Release__r.Name": _get(r, "copado__User_Story__r", "copado__Release__r", "Name"),
            "copado__User_Story__r.copado__Project__r.Name": _get(r, "copado__User_Story__r", "copado__Project__r", "Name"),
            "copado__User_Story__r.copado__Developer__r.Name": _get(r, "copado__User_Story__r", "copado__Developer__r", "Name"),
            "copado__User_Story__r.copado__Close_Date__c": _get(r, "copado__User_Story__r", "copado__Close_Date__c"),
            "copado__User_Story__r.copado__Story_Points_SFDC__c": _get(r, "copado__User_Story__r", "copado__Story_Points_SFDC__c"),
            "copado__User_Story__r.copado__Environment__r.Name": _get(r, "copado__User_Story__r", "copado__Environment__r", "Name"),
            "copado__Metadata_API_Name__c": r.get("copado__Metadata_API_Name__c"),
            "copado__Type__c": r.get("copado__Type__c"),
            "copado__Category__c": r.get("copado__Category__c"),
            "copado__Action__c": r.get("copado__Action__c"),
            "copado__Status__c": r.get("copado__Status__c"),
            "copado__ModuleDirectory__c": r.get("copado__ModuleDirectory__c"),
            "copado__Last_Commit_Date__c": r.get("copado__Last_Commit_Date__c"),
            "copado__JsonInformation__c": r.get("copado__JsonInformation__c"),
            "copado__Unique_ID__c": r.get("copado__Unique_ID__c"),
            "CreatedDate": r.get("CreatedDate"),
            "CreatedBy.Name": _get(r, "CreatedBy", "Name"),
            "LastModifiedDate": r.get("LastModifiedDate"),
            "LastModifiedBy.Name": _get(r, "LastModifiedBy", "Name"),
        })
    return rows
