// src/ui/tabs/development-tools/utils.js
// Shared utilities for all development tools

/**
 * Format date to readable string
 */
export function formatDate(dateString) {
  if (!dateString) return 'Unknown';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (e) {
    return dateString;
  }
}

/**
 * Escape HTML to prevent XSS
 */
export function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}

/**
 * Create loading indicator
 */
export function createLoadingIndicator(message = 'Loading...') {
  const div = document.createElement('div');
  div.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
  `;

  div.innerHTML = `
    <div style="
      background: white;
      padding: 30px;
      border-radius: 8px;
      text-align: center;
    ">
      <div style="
        font-size: 30px;
        margin-bottom: 10px;
        animation: spin 2s linear infinite;
      ">⚙️</div>
      <p style="margin: 0; font-size: 16px; color: #333;">${message}</p>
    </div>

    <style>
      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
    </style>
  `;

  return div;
}

/**
 * Create error indicator
 */
export function createErrorIndicator(message = 'An error occurred') {
  const div = document.createElement('div');
  div.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
  `;

  div.innerHTML = `
    <div style="
      background: white;
      padding: 30px;
      border-radius: 8px;
      text-align: center;
      max-width: 400px;
    ">
      <div style="
        font-size: 40px;
        margin-bottom: 10px;
        color: #ef4444;
      ">⚠️</div>
      <p style="margin: 0 0 15px 0; font-size: 16px; color: #333; font-weight: 600;">Error</p>
      <p style="margin: 0 0 20px 0; font-size: 14px; color: #666;">${message}</p>
      <button onclick="this.parentElement.parentElement.remove()" style="
        background: #ef4444;
        color: white;
        border: none;
        padding: 10px 20px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 600;
      ">
        Dismiss
      </button>
    </div>
  `;

  return div;
}

/**
 * Extract unique components from ANALYSIS
 */
export function getUniqueComponents(analysis) {
  if (!analysis) return [];

  const componentSet = new Set();
  const components = [];

  // Extract from conflicts
  if (Array.isArray(analysis.component_conflicts)) {
    analysis.component_conflicts.forEach(conflict => {
      const name = conflict.component_name || conflict.name;
      if (name && !componentSet.has(name)) {
        componentSet.add(name);
        components.push({
          name: name,
          type: conflict.component_type || guessComponentType(name)
        });
      }
    });
  }

  // Extract from stories
  if (Array.isArray(analysis.all_stories)) {
    analysis.all_stories.forEach(story => {
      const storyComponents = story.components || story.changed_components || [];
      storyComponents.forEach(comp => {
        const name = comp.name || comp;
        if (name && !componentSet.has(name)) {
          componentSet.add(name);
          components.push({
            name: name,
            type: comp.type || guessComponentType(name)
          });
        }
      });
    });
  }

  console.log('📊 Extracted unique components:', components.length);
  return components;
}

/**
 * Guess component type from name
 */
export function guessComponentType(componentName) {
  if (componentName.endsWith('.cls')) return 'ApexClass';
  if (componentName.endsWith('.trigger')) return 'ApexTrigger';
  if (componentName.endsWith('.page')) return 'VisualforcePage';
  if (componentName.endsWith('.component')) return 'ApexComponent';
  if (componentName.endsWith('.layout')) return 'Layout';
  if (componentName.endsWith('.object')) return 'CustomObject';
  if (componentName.endsWith('.field')) return 'CustomField';
  return 'Component';
}

/**
 * Deep clone object
 */
export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Check if object is empty
 */
export function isEmpty(obj) {
  return Object.keys(obj).length === 0;
}

/**
 * Debounce function calls
 */
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Modal styling helper
 */
export const MODAL_STYLES = {
  backdrop: `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  `,
  container: `
    background: white;
    border-radius: 12px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    max-width: 900px;
    max-height: 85vh;
    overflow-y: auto;
  `,
  header: `
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 24px;
    border-radius: 12px 12px 0 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
  `,
  closeButton: `
    background: rgba(255,255,255,0.2);
    border: none;
    color: white;
    font-size: 24px;
    cursor: pointer;
    padding: 0;
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s;
  `
};