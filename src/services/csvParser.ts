import { CopadoMetadata } from '../types';

/**
 * CSV Parser Service
 * Handles parsing of Copado metadata CSV exports
 * Supports both simplified and full Copado field naming conventions
 */

interface ParseResult {
  data: CopadoMetadata[];
  errors: string[];
}

/**
 * Maps Copado column names to internal field names
 * Supports multiple naming variations for flexibility
 */
const COLUMN_MAPPINGS = {
  userStory: [
    'copado__User_Story__r.Name',
    'User_Story__r.Name',
    'userStory',
    'User Story'
  ],
  metadataName: [
    'copado__Metadata_API_Name__c',
    'Metadata_API_Name__c',
    'metadataName',
    'Metadata Name'
  ],
  lastCommitDate: [
    'copado__Last_Commit_Date__c',
    'Last_Commit_Date__c',
    'lastCommitDate',
    'Last Commit Date'
  ],
  developer: [
    'copado__User_Story__r.copado__Developer__r.Name',
    'Developer__r.Name',
    'developer',
    'Developer'
  ],
  type: [
    'copado__Type__c',
    'Type__c',
    'type',
    'Type'
  ]
};

/**
 * Finds column index by checking multiple possible names
 */
const findColumnIndex = (
  headers: string[],
  possibleNames: string[]
): number => {
  for (const name of possibleNames) {
    const idx = headers.findIndex(h => 
      h === name || h.toLowerCase().includes(name.toLowerCase())
    );
    if (idx !== -1) return idx;
  }
  return -1;
};

/**
 * Parses CSV text into structured CopadoMetadata array
 * 
 * @param csvText - Raw CSV file content
 * @returns ParseResult with data and any errors encountered
 */
export const parseCopadoCSV = (csvText: string): ParseResult => {
  const errors: string[] = [];
  
  try {
    const lines = csvText.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      return {
        data: [],
        errors: ['CSV file is empty or has no data rows']
      };
    }

    const headers = lines[0].split(',').map(h => h.trim());
    
    // Find required columns
    const storyIdx = findColumnIndex(headers, COLUMN_MAPPINGS.userStory);
    const metadataIdx = findColumnIndex(headers, COLUMN_MAPPINGS.metadataName);
    
    if (storyIdx === -1 || metadataIdx === -1) {
      return {
        data: [],
        errors: [
          'CSV must contain User Story and Metadata Name columns',
          `Available columns: ${headers.join(', ')}`
        ]
      };
    }

    // Find optional columns
    const dateIdx = findColumnIndex(headers, COLUMN_MAPPINGS.lastCommitDate);
    const developerIdx = findColumnIndex(headers, COLUMN_MAPPINGS.developer);
    const typeIdx = findColumnIndex(headers, COLUMN_MAPPINGS.type);

    // Parse data rows
    const data: CopadoMetadata[] = lines
      .slice(1)
      .map((line, index) => {
        const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        
        const row: CopadoMetadata = {
          userStory: values[storyIdx] || '',
          metadataName: values[metadataIdx] || ''
        };

        if (dateIdx !== -1) row.lastCommitDate = values[dateIdx];
        if (developerIdx !== -1) row.developer = values[developerIdx];
        if (typeIdx !== -1) row.type = values[typeIdx];

        // Validate required fields
        if (!row.userStory || !row.metadataName) {
          errors.push(`Row ${index + 2}: Missing required fields`);
          return null;
        }

        return row;
      })
      .filter((row): row is CopadoMetadata => row !== null);

    return { data, errors };

  } catch (error) {
    return {
      data: [],
      errors: [`Parse error: ${error instanceof Error ? error.message : 'Unknown error'}`]
    };
  }
};

/**
 * Validates CSV structure before full parsing
 */
export const validateCSVStructure = (csvText: string): boolean => {
  const lines = csvText.split('\n');
  if (lines.length < 2) return false;
  
  const headers = lines[0].split(',');
  return headers.length >= 2; // At minimum need 2 columns
};