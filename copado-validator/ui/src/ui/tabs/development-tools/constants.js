// ============================================================================
// CONSTANTS - Development Tools
// src/ui/tabs/development-tools/constants.js
// ============================================================================

/**
 * Professional icons for tools
 * Using Unicode symbols for consistency across browsers
 * Can be upgraded to Lucide React later
 */
export const TOOL_ICONS = {
  PRECHECK: '✓',
  HISTORY: '⟳',
  COMPARE: '⇄',
  SUCCESS: '✓',
  ERROR: '⚠',
  WARNING: '⚡',
  LOADING: '⟳',
  INFO: 'ℹ',
  DOWNLOAD: '↓',
  UPLOAD: '↑',
  CLOSE: '✕',
};

/**
 * Professional labels for tools
 */
export const TOOL_LABELS = {
  PRECHECK: 'Pre-Check',
  HISTORY: 'Component History',
  COMPARE: 'Environment Comparison',
  MYWORK: 'Development Tools',
};

/**
 * Tool descriptions
 */
export const TOOL_DESCRIPTIONS = {
  PRECHECK: 'Check component status and health across all environments before deployment',
  HISTORY: 'View change history, commits, and deployment timeline for components',
  COMPARE: 'Compare component versions and configurations between two environments',
};

/**
 * Environment configuration
 */
export const ENVIRONMENTS = [
  {
    key: 'uat',
    branch: 'uatsfdc',
    name: 'UAT',
    icon: '🔧',
    color: '#FFA500',
    description: 'User Acceptance Testing'
  },
  {
    key: 'qasales',
    branch: 'qasales',
    name: 'QA',
    icon: '🧪',
    color: '#6C5CE7',
    description: 'Quality Assurance - Sales'
  },
  {
    key: 'prep',
    branch: 'prep',
    name: 'PreProd',
    icon: '🟡',
    color: '#FDCB6E',
    description: 'Pre-Production Environment'
  },
  {
    key: 'master',
    branch: 'master',
    name: 'Production',
    icon: '🚀',
    color: '#00B894',
    description: 'Production Environment'
  }
];

/**
 * Component types
 */
export const COMPONENT_TYPES = [
  {
    value: 'DataRaptor',
    label: 'DataRaptor',
    icon: '📊'
  },
  {
    value: 'IntegrationProcedure',
    label: 'Integration Procedure',
    icon: '🔗'
  },
  {
    value: 'FlexCard',
    label: 'Flex Card',
    icon: '🎴'
  },
  {
    value: 'OmniScript',
    label: 'OmniScript',
    icon: '📝'
  },
  {
    value: 'Action',
    label: 'Action',
    icon: '⚡'
  },
  {
    value: 'Decision',
    label: 'Decision',
    icon: '🎯'
  }
];

/**
 * Status labels and colors
 */
export const STATUS = {
  SUCCESS: {
    label: 'Success',
    color: '#00B894',
    background: '#F0FFF4',
    icon: '✓'
  },
  WARNING: {
    label: 'Warning',
    color: '#FDCB6E',
    background: '#FFF8F0',
    icon: '⚡'
  },
  ERROR: {
    label: 'Error',
    color: '#D63031',
    background: '#FFF0F0',
    icon: '✕'
  },
  PENDING: {
    label: 'Pending',
    color: '#0984E3',
    background: '#F0F8FF',
    icon: '⟳'
  },
  INFO: {
    label: 'Info',
    color: '#636E72',
    background: '#F5F6FA',
    icon: 'ℹ'
  }
};

/**
 * API endpoints (relative to your existing endpoints)
 */
export const API_ENDPOINTS = {
  PRODUCTION_STATE: '/api/production-state',
  COMPONENT_HISTORY: '/api/component-history',
  ENVIRONMENT_DATA: '/api/environment-data',
  COMMIT_HISTORY: '/api/commit-history',
  DEPLOYMENT_STATUS: '/api/deployment-status'
};

/**
 * Console messages with emojis
 */
export const CONSOLE_MESSAGES = {
  OPEN_TOOL: '✅ Opening',
  LOADING: '🔄 Loading',
  SUCCESS: '✅ Success',
  ERROR: '❌ Error',
  WARNING: '⚠️ Warning',
  INFO: 'ℹ️ Info',
  ADD: '➕ Added',
  REMOVE: '🗑️ Removed',
  UPDATE: '📝 Updated',
  COMPLETE: '✔️ Complete',
  SCANNING: '🔍 Scanning',
  COMPARING: '⇄ Comparing',
  EXPORTING: '📥 Exporting',
  VALIDATING: '✓ Validating'
};

/**
 * Timing and limits
 */
export const LIMITS = {
  MAX_COMPONENTS: 50,
  MAX_COMMITS: 100,
  MIN_COMPONENTS: 1,
  MODAL_ANIMATION_MS: 300,
  SPINNER_UPDATE_MS: 1000,
  DEFAULT_COMMIT_LIMIT: 5,
  MAX_CUSTOM_COMMITS: 50,
  DEBOUNCE_MS: 300,
  TIMEOUT_MS: 30000
};

/**
 * Get environment by key
 */
export function getEnvironment(key) {
  return ENVIRONMENTS.find(env => env.key === key);
}

/**
 * Get environment name
 */
export function getEnvironmentName(key) {
  const env = getEnvironment(key);
  return env ? env.name : key;
}

/**
 * Get environment branch
 */
export function getEnvironmentBranch(key) {
  const env = getEnvironment(key);
  return env ? env.branch : key;
}

/**
 * Get component type label
 */
export function getComponentTypeLabel(value) {
  const type = COMPONENT_TYPES.find(t => t.value === value);
  return type ? type.label : value;
}

/**
 * Get status styling
 */
export function getStatusStyle(status) {
  return STATUS[status] || STATUS.INFO;
}