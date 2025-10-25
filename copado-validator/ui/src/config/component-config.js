// ============================================================================
// src/config/component-config.js
// ENHANCED COMPONENT_CONFIG - Component Types Configuration
// Centralized configuration for all component types, environments, and filters
// ============================================================================

const COMPONENT_CONFIG = {
  // =========================================================================
  // COMPONENT TYPES - All supported component types
  // =========================================================================
  types: [
    {
      id: 'DataRaptor',
      label: 'DataRaptor',
      description: 'Data Transformation',
      icon: '🔧',
      category: 'Integration',
      apiValue: 'DataRaptor'
    },
    {
      id: 'IntegrationProcedure',
      label: 'Integration Procedure',
      description: 'Integration Logic',
      icon: '⚙️',
      category: 'Integration',
      apiValue: 'IntegrationProcedure'
    },
    {
      id: 'ApexClass',
      label: 'Apex Class',
      description: 'Custom Code',
      icon: '📝',
      category: 'Code',
      apiValue: 'ApexClass'
    },
    {
      id: 'Flow',
      label: 'Flow',
      description: 'Flow Definition',
      icon: '🔄',
      category: 'Automation',
      apiValue: 'Flow'
    },
    {
      id: 'CustomField',
      label: 'Custom Field',
      description: 'Field Definition',
      icon: '📊',
      category: 'Field',
      apiValue: 'Field'
    },
    {
      id: 'OmniScript',
      label: 'OmniScript',
      description: 'OmniScript Definition',
      icon: '📋',
      category: 'Integration',
      apiValue: 'OmniScript'
    },
    {
      id: 'ApexTrigger',
      label: 'Apex Trigger',
      description: 'Apex Trigger Code',
      icon: '⚡',
      category: 'Code',
      apiValue: 'Trigger'
    },
    {
      id: 'VisualforceComponent',
      label: 'Visualforce Component',
      description: 'Visualforce Component',
      icon: '🧩',
      category: 'UI',
      apiValue: 'Component'
    },
    {
      id: 'VisuaforcePage',
      label: 'Visualforce Page',
      description: 'Visualforce Page',
      icon: '📄',
      category: 'UI',
      apiValue: 'Page'
    },
    {
      id: 'PageLayout',
      label: 'Page Layout',
      description: 'Page Layout',
      icon: '🎨',
      category: 'UI',
      apiValue: 'Layout'
    },
    {
      id: 'RecordType',
      label: 'Record Type',
      description: 'Record Type',
      icon: '🏷️',
      category: 'Custom',
      apiValue: 'RecordType'
    },
    {
      id: 'CustomObject',
      label: 'Custom Object',
      description: 'Custom Object',
      icon: '📦',
      category: 'Custom',
      apiValue: 'CustomObject'
    }
  ],

  // =========================================================================
  // ENVIRONMENTS/BRANCHES - 4 environments
  // =========================================================================
  environments: [
    {
      id: 'master',
      value: 'master',
      label: 'Production',
      shortLabel: 'master',
      icon: '🚀',
      color: '#ff5252',
      risk: 'high',
      description: 'Production environment - HIGHEST RISK',
      order: 1
    },
    {
      id: 'prep',
      value: 'prep',
      label: 'Pre-production',
      shortLabel: 'prep',
      icon: '🔧',
      color: '#ff9800',
      risk: 'medium',
      description: 'Pre-production environment for final testing',
      order: 2
    },
    {
      id: 'uatsfdc',
      value: 'uatsfdc',
      label: 'UAT',
      shortLabel: 'uatsfdc',
      icon: '✅',
      color: '#4caf50',
      risk: 'low',
      description: 'User Acceptance Testing environment',
      order: 3
    },
    {
      id: 'qasales',
      value: 'qasales',
      label: 'QA',
      shortLabel: 'qasales',
      icon: '🧪',
      color: '#2196f3',
      risk: 'low',
      description: 'Quality Assurance environment',
      order: 4
    }
  ],

  // =========================================================================
  // FILTERS - Pre-check result filters
  // =========================================================================
  filters: [
    {
      id: 'all',
      value: 'all',
      label: 'Show All Components',
      description: 'Display all components regardless of status',
      icon: '📦',
      order: 1
    },
    {
      id: 'existing',
      value: 'existing',
      label: 'Show Only Existing',
      description: 'Show only components that exist in the environment',
      icon: '✓',
      order: 2
    },
    {
      id: 'missing',
      value: 'missing',
      label: 'Show Only Missing',
      description: 'Show only components missing from the environment',
      icon: '✗',
      order: 3
    }
  ],

  // =========================================================================
  // COMPONENT TYPE METHODS
  // =========================================================================

  /**
   * Get type by ID
   * @param {string} id - Component type ID
   * @returns {Object} Component type object
   */
  getType: function(id) {
    return this.types.find(t => t.id === id);
  },

  /**
   * Get type by API value
   * @param {string} apiValue - API value
   * @returns {Object} Component type object
   */
  getTypeByApiValue: function(apiValue) {
    return this.types.find(t => t.apiValue === apiValue);
  },

  /**
   * Get icon for type
   * @param {string} id - Component type ID
   * @returns {string} Icon emoji
   */
  getIcon: function(id) {
    const type = this.getType(id);
    return type ? type.icon : '📦';
  },

  /**
   * Get description for type
   * @param {string} id - Component type ID
   * @returns {string} Description
   */
  getDescription: function(id) {
    const type = this.getType(id);
    return type ? type.description : id;
  },

  /**
   * Get label for type
   * @param {string} id - Component type ID
   * @returns {string} Label
   */
  getLabel: function(id) {
    const type = this.getType(id);
    return type ? type.label : id;
  },

  /**
   * Get types by category
   * @param {string} category - Category name
   * @returns {Array} Filtered types
   */
  getTypesByCategory: function(category) {
    return this.types.filter(t => t.category === category);
  },

  /**
   * Get all categories
   * @returns {Array} Unique categories
   */
  getCategories: function() {
    const categories = new Set(this.types.map(t => t.category));
    return Array.from(categories).sort();
  },

  /**
   * Get all type options HTML for select dropdown
   * @returns {string} HTML options
   */
  getTypeOptions: function() {
    return this.types.map(t => 
      `<option value="${t.id}">${t.icon} ${t.label}</option>`
    ).join('');
  },

  /**
   * Get all types as array
   * @returns {Array} Array of type objects
   */
  getTypesArray: function() {
    return this.types;
  },

  // =========================================================================
  // ENVIRONMENT METHODS
  // =========================================================================

  /**
   * Get environment by ID
   * @param {string} id - Environment ID
   * @returns {Object} Environment object
   */
  getEnvironment: function(id) {
    return this.environments.find(e => e.id === id || e.value === id);
  },

  /**
   * Get environment by risk level
   * @param {string} risk - Risk level: 'low', 'medium', 'high'
   * @returns {Array} Environments with that risk
   */
  getEnvironmentsByRisk: function(risk) {
    return this.environments.filter(e => e.risk === risk);
  },

  /**
   * Get all environments sorted by order
   * @returns {Array} Sorted environment objects
   */
  getEnvironmentsArray: function() {
    return this.environments.sort((a, b) => a.order - b.order);
  },

  /**
   * Get all environment options HTML for select dropdown
   * @returns {string} HTML options
   */
  getEnvironmentOptions: function() {
    return this.getEnvironmentsArray().map(e => 
      `<option value="${e.value}">${e.icon} ${e.label}</option>`
    ).join('');
  },

  // =========================================================================
  // FILTER METHODS
  // =========================================================================

  /**
   * Get filter by ID
   * @param {string} id - Filter ID
   * @returns {Object} Filter object
   */
  getFilter: function(id) {
    return this.filters.find(f => f.id === id || f.value === id);
  },

  /**
   * Get all filters sorted by order
   * @returns {Array} Sorted filter objects
   */
  getFiltersArray: function() {
    return this.filters.sort((a, b) => a.order - b.order);
  },

  /**
   * Get filter radio HTML for form
   * @returns {string} HTML for filter options
   */
  getFilterRadioHTML: function() {
    return this.getFiltersArray().map(f => `
      <label style="display: flex; align-items: center; cursor: pointer; font-size: 14px; margin-bottom: 8px;">
        <input type="radio" name="filter" value="${f.value}" ${f.id === 'all' ? 'checked' : ''} style="margin-right: 8px;">
        <span><strong>${f.label}</strong></span>
      </label>
      <p style="font-size: 12px; color: #999999; margin: -6px 0 8px 24px;">
        ${f.description}
      </p>
    `).join('');
  },

  // =========================================================================
  // UTILITY METHODS
  // =========================================================================

  /**
   * Normalize component name
   * @param {string|Object} component - Component to normalize
   * @param {string} defaultType - Default type if not specified
   * @returns {Object} Normalized { name, type, id }
   */
  normalizeComponent: function(component, defaultType = 'CustomObject') {
    if (typeof component === 'string') {
      return { 
        name: component, 
        type: defaultType,
        id: defaultType
      };
    }

    if (typeof component === 'object' && component.name) {
      const typeId = component.type || component.id || defaultType;
      const typeObj = this.getType(typeId) || this.getTypeByApiValue(typeId);
      
      return {
        name: component.name,
        type: typeObj ? typeObj.apiValue : typeId,
        id: typeObj ? typeObj.id : typeId
      };
    }

    return null;
  },

  /**
   * Convert components to API format
   * @param {Array} components - Components array
   * @returns {Array} API-formatted components
   */
  toApiFormat: function(components) {
    return components.map(comp => {
      const normalized = this.normalizeComponent(comp);
      return {
        type: normalized.type,
        name: normalized.name
      };
    }).filter(c => c !== null);
  },

  /**
   * Validate component type exists
   * @param {string} typeId - Component type ID
   * @returns {boolean} True if exists
   */
  isValidType: function(typeId) {
    return this.getType(typeId) !== undefined;
  },

  /**
   * Validate environment exists
   * @param {string} envId - Environment ID
   * @returns {boolean} True if exists
   */
  isValidEnvironment: function(envId) {
    return this.getEnvironment(envId) !== undefined;
  },

  /**
   * Get all config as object
   * @returns {Object} Complete configuration
   */
  getConfig: function() {
    return {
      types: this.types,
      environments: this.environments,
      filters: this.filters
    };
  },

  /**
   * Log all configuration (debug helper)
   */
  debug: function() {
    console.log('=== COMPONENT CONFIG ===');
    console.log('Types:', this.types);
    console.log('Environments:', this.environments);
    console.log('Filters:', this.filters);
  }
};

// ============================================================================
// EXPORT - ES6 syntax that works with modern imports
// ============================================================================
export default COMPONENT_CONFIG;