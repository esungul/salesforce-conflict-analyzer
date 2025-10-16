"""
CSV Parser for Copado Exports

Reads CSV files from Copado and transforms them into our data models.
Uses pandas for robust CSV handling.
"""

import pandas as pd
from typing import List, Dict
from datetime import datetime
from models import (
    Component, UserStory, ParsedData,
    MetadataType, ConflictStatus
)


class CopadoCSVParser:
    """
    Parses Copado CSV exports into structured data
    
    Usage:
        parser = CopadoCSVParser()
        result = parser.parse_file('data.csv')
        print(f"Found {len(result.user_stories)} stories")
    """
    
    def __init__(self):
        """Initialize the parser"""
        pass
    
    def parse_file(self, file_path: str) -> ParsedData:
        """
        Parse a CSV file and return structured data
        
        Args:
            file_path: Path to the CSV file
            
        Returns:
            ParsedData object with all user stories and components
        """
        # Step 1: Read CSV with pandas
        df = pd.read_csv(file_path)
        
        # Step 2: Clean data (strip whitespace from column names)
        df.columns = df.columns.str.strip()
        
        # Step 3: Group by user story
        user_stories = self._transform_to_user_stories(df)
        
        # Step 4: Collect all components
        all_components = []
        for story in user_stories:
            all_components.extend(story.components)
        
        # Step 5: Calculate statistics
        unique_components = len(set(c.api_name for c in all_components))
        
        return ParsedData(
            user_stories=user_stories,
            components=all_components,
            total_records=len(df),
            unique_stories=len(user_stories),
            unique_components=unique_components
        )
    
    def _transform_to_user_stories(self, df: pd.DataFrame) -> List[UserStory]:
        """
        Transform DataFrame rows into UserStory objects
        
        Args:
            df: Pandas DataFrame with CSV data
            
        Returns:
            List of UserStory objects
        """
        stories_dict: Dict[str, UserStory] = {}
        
        for _, row in df.iterrows():
            # Get user story ID
            story_id = str(row.get('copado__User_Story__r.Name', 'UNKNOWN'))
            
            # Create user story if doesn't exist
            if story_id not in stories_dict:
                stories_dict[story_id] = UserStory(
                    id=story_id,
                    title=str(row.get('copado__User_Story__r.copado__User_Story_Title__c', '')),
                    jira_key=self._get_optional_string(row, 'copado__User_Story__r.copadoccmint__JIRA_key__c'),
                    project=str(row.get('copado__User_Story__r.copado__Project__r.Name', 'Unknown')),
                    environment=str(row.get('copado__User_Story__r.copado__Environment__r.Name', 'Unknown')),
                    developer=self._get_optional_string(row, 'copado__User_Story__r.copado__Developer__r.Name'),
                    components=[]
                )
            
            # Create component and add to story
            component = self._create_component(row, story_id)
            stories_dict[story_id].components.append(component)
        
        return list(stories_dict.values())
    
    def _create_component(self, row: pd.Series, story_id: str) -> Component:
        """
        Create a Component object from a CSV row
        
        Args:
            row: Single row from DataFrame
            story_id: ID of parent user story
            
        Returns:
            Component object
        """
        return Component(
            api_name=str(row.get('copado__Metadata_API_Name__c', 'Unknown')),
            type=self._map_metadata_type(row.get('copado__Type__c')),
            status=self._map_conflict_status(row.get('copado__Status__c')),
            user_story_id=story_id,
            unique_id=str(row.get('copado__Unique_ID__c', '')),
            last_commit_date=self._parse_date(row.get('copado__Last_Commit_Date__c')),
            created_by=self._get_optional_string(row, 'CreatedBy.Name'),
            commit_hash=row.get('copado__User_Story_Commit__c')

             
        )
    
    def _map_metadata_type(self, type_str) -> MetadataType:
        """Map CSV string to MetadataType enum"""
        if pd.isna(type_str):
            return MetadataType.UNKNOWN
        
        type_map = {
            'ApexClass': MetadataType.APEX_CLASS,
            'IntegrationProcedure': MetadataType.INTEGRATION_PROCEDURE,
            'DataRaptor': MetadataType.DATA_RAPTOR,
            'OmniScript': MetadataType.OMNI_SCRIPT,
            'PermissionSet': MetadataType.PERMISSION_SET,
            'Flow': MetadataType.FLOW,
            'Product2': MetadataType.PRODUCT,
            'System': MetadataType.SYSTEM,
        }
        
        return type_map.get(str(type_str), MetadataType.UNKNOWN)
    
    def _map_conflict_status(self, status_str) -> ConflictStatus:
        """Map CSV string to ConflictStatus enum"""
        if pd.isna(status_str):
            return ConflictStatus.UNKNOWN
        
        status_map = {
            'Potential Conflict': ConflictStatus.POTENTIAL_CONFLICT,
            'Auto-resolved': ConflictStatus.AUTO_RESOLVED,
            'Back Promoted': ConflictStatus.BACK_PROMOTED,
        }
        
        return status_map.get(str(status_str), ConflictStatus.UNKNOWN)
    
    def _parse_dateback(self, date_str) -> datetime:
        """Parse date string from Copado CSV"""
        if pd.isna(date_str):
            return None
        
        try:
            return pd.to_datetime(date_str)
        except:
            return None
     
    def _parse_date(self, date_str) -> datetime:
        """Parse date string from Copado CSV and ensure timezone-naive"""
        if pd.isna(date_str):
            return None
        
        try:
            # Parse the date
            parsed_date = pd.to_datetime(date_str)
            
            # If it's timezone-aware, convert to timezone-naive in UTC
            if parsed_date.tz is not None:
                parsed_date = parsed_date.tz_convert('UTC').tz_localize(None)
            
            return parsed_date
        except Exception as e:
            print(f"Error parsing date '{date_str}': {e}")
            return None
        
    def _get_optional_string(self, row: pd.Series, column: str) -> str:
        """Get string value or None if missing"""
        value = row.get(column)
        if pd.isna(value):
            return None
        return str(value)