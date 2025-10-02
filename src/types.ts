/**
 * COPADO DEPLOYMENT VALIDATOR - TYPE DEFINITIONS
 * 
 * This file defines the "shape" of all our data.
 * Think of it as a contract - everyone agrees on what data looks like.
 */

// =============================================================================
// ENUMS - Predefined Constants
// =============================================================================

/**
 * Metadata types in Salesforce/Copado
 * These are the different kinds of components you can deploy
 */
export enum MetadataType {
  APEX_CLASS = 'ApexClass',
  INTEGRATION_PROCEDURE = 'IntegrationProcedure',
  DATA_RAPTOR = 'DataRaptor',
  OMNI_SCRIPT = 'OmniScript',
  PERMISSION_SET = 'PermissionSet',
  FLOW = 'Flow',
  PRODUCT = 'Product2',
  SYSTEM = 'System',
  UNKNOWN = 'Unknown'
}

/**
 * Conflict status from Copado
 */
export enum ConflictStatus {
  POTENTIAL_CONFLICT = 'Potential Conflict',
  AUTO_RESOLVED = 'Auto-resolved',
  BACK_PROMOTED = 'Back Promoted',
  UNKNOWN = 'Unknown'
}

/**
 * Risk severity levels
 * Used to classify how dangerous a conflict is
 */
export enum ConflictSeverity {
  LOW = 0,      // Safe to deploy
  MEDIUM = 1,   // Review recommended
  HIGH = 2,     // Careful testing needed
  CRITICAL = 3, // High risk of bugs
  BLOCKER = 4   // Must manually resolve
}
