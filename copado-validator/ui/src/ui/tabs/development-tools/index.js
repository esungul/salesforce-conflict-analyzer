// ============================================================================
// DEVELOPMENT TOOLS - Main Entry Point
// src/ui/tabs/development-tools/index.js
// FIXED VERSION - All paths corrected
// ============================================================================

import { TOOL_ICONS, TOOL_LABELS, TOOL_DESCRIPTIONS } from './constants.js';

/**
 * Render development tools dashboard
 */
export function renderDevelopmentTools(container) {
  const html = `
    <div style="
      background: var(--color-white);
      border-radius: 12px;
      padding: var(--spacing-lg);
    ">
      <div style="margin-bottom: var(--spacing-2xl);">
        <h2 style="
          margin: 0 0 var(--spacing-sm);
          font-size: 20px;
          font-weight: 700;
          color: var(--color-black);
        ">⚙️ Development Tools</h2>
        <p style="
          margin: 0;
          font-size: 14px;
          color: var(--color-gray-6);
          line-height: 1.5;
        ">Professional tools for component validation, history tracking, and environment comparison</p>
      </div>

      <div style="
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
        gap: var(--spacing-lg);
      ">
        <!-- PRE-CHECK TOOL -->
        <div style="
          background: linear-gradient(135deg, #f5f7fa 0%, #f0f4f8 100%);
          border: 2px solid var(--color-gray-3);
          border-radius: 12px;
          padding: var(--spacing-lg);
          cursor: pointer;
          transition: all 0.3s ease;
          display: flex;
          flex-direction: column;
        "
        onclick="window.openPrecheckTool()"
        onmouseover="this.style.borderColor='var(--color-blue)'; this.style.boxShadow='var(--shadow-md)'; this.style.transform='translateY(-2px)'"
        onmouseout="this.style.borderColor='var(--color-gray-3)'; this.style.boxShadow='none'; this.style.transform='translateY(0)'"
        >
          <div style="font-size: 32px; margin-bottom: var(--spacing-md);">🛡️</div>
          <h3 style="
            margin: 0 0 var(--spacing-sm);
            font-size: 16px;
            font-weight: 600;
            color: var(--color-black);
          ">Pre-Check Tool</h3>
          <p style="
            margin: 0;
            font-size: 13px;
            color: var(--color-gray-6);
            line-height: 1.4;
            flex-grow: 1;
          ">Validate component readiness across all environments before deployment</p>
          <div style="
            margin-top: var(--spacing-md);
            padding-top: var(--spacing-md);
            border-top: 1px solid var(--color-gray-3);
            font-size: 12px;
            color: var(--color-blue);
            font-weight: 600;
          ">Open Tool →</div>
        </div>

        <!-- HISTORY TOOL -->
        <div style="
          background: linear-gradient(135deg, #fff5f0 0%, #ffe8e1 100%);
          border: 2px solid var(--color-gray-3);
          border-radius: 12px;
          padding: var(--spacing-lg);
          cursor: pointer;
          transition: all 0.3s ease;
          display: flex;
          flex-direction: column;
        "
        onclick="window.openHistoryTool()"
        onmouseover="this.style.borderColor='var(--color-orange)'; this.style.boxShadow='var(--shadow-md)'; this.style.transform='translateY(-2px)'"
        onmouseout="this.style.borderColor='var(--color-gray-3)'; this.style.boxShadow='none'; this.style.transform='translateY(0)'"
        >
          <div style="font-size: 32px; margin-bottom: var(--spacing-md);">📜</div>
          <h3 style="
            margin: 0 0 var(--spacing-sm);
            font-size: 16px;
            font-weight: 600;
            color: var(--color-black);
          ">History Tool</h3>
          <p style="
            margin: 0;
            font-size: 13px;
            color: var(--color-gray-6);
            line-height: 1.4;
            flex-grow: 1;
          ">Track component changes, commits, and deployment history across branches</p>
          <div style="
            margin-top: var(--spacing-md);
            padding-top: var(--spacing-md);
            border-top: 1px solid var(--color-gray-3);
            font-size: 12px;
            color: var(--color-orange);
            font-weight: 600;
          ">Open Tool →</div>
        </div>

        <!-- COMPARISON TOOL -->
        <div style="
          background: linear-gradient(135deg, #f0f9ff 0%, #e1f5ff 100%);
          border: 2px solid var(--color-gray-3);
          border-radius: 12px;
          padding: var(--spacing-lg);
          cursor: pointer;
          transition: all 0.3s ease;
          display: flex;
          flex-direction: column;
        "
        onclick="window.openComparisonTool()"
        onmouseover="this.style.borderColor='var(--color-cyan)'; this.style.boxShadow='var(--shadow-md)'; this.style.transform='translateY(-2px)'"
        onmouseout="this.style.borderColor='var(--color-gray-3)'; this.style.boxShadow='none'; this.style.transform='translateY(0)'"
        >
          <div style="font-size: 32px; margin-bottom: var(--spacing-md);">⇄</div>
          <h3 style="
            margin: 0 0 var(--spacing-sm);
            font-size: 16px;
            font-weight: 600;
            color: var(--color-black);
          ">Comparison Tool</h3>
          <p style="
            margin: 0;
            font-size: 13px;
            color: var(--color-gray-6);
            line-height: 1.4;
            flex-grow: 1;
          ">Compare components between environments and generate detailed diff reports</p>
          <div style="
            margin-top: var(--spacing-md);
            padding-top: var(--spacing-md);
            border-top: 1px solid var(--color-gray-3);
            font-size: 12px;
            color: var(--color-cyan);
            font-weight: 600;
          ">Open Tool →</div>
        </div>
      </div>
    </div>
  `;

  if (container) {
    container.innerHTML = html;
  }

  return html;
}

/**
 * Initialize window functions for tool access
 * Called from main.js
 */
export function initializeDeveloperTools() {
  console.log('🔧 Initializing Developer Tools...');

  // Tools will be initialized when main.js imports them
  window.renderDevelopmentTools = renderDevelopmentTools;

  console.log('✅ Developer Tools initialized');
}

/**
 * Get tool status
 */
export function getToolStatus() {
  return {
    precheck: !!window.openPrecheckTool,
    history: !!window.openHistoryTool,
    comparison: !!window.openComparisonTool
  };
}