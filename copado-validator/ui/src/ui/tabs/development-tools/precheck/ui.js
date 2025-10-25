// src/ui/tabs/development-tools/precheck/ui.js
// UI rendering for pre-check modal

import { escapeHtml, formatDate, MODAL_STYLES } from '../utils.js';

/**
 * Create pre-check modal UI
 */
export function createPrecheckModal(precheckResult, recommendations) {
  const modal = document.createElement('div');
  const modalId = 'precheck-modal-' + Date.now();
  modal.id = modalId;

  const { status, summary, existingComponents, missingComponents } = precheckResult;
  const statusColor = status === 'ready' ? '#10b981' : '#f59e0b';
  const statusIcon = status === 'ready' ? '✓' : '⚠️';
  const statusText = status === 'ready' ? 'Ready for Deployment' : 'Review Required';

  modal.style.cssText = MODAL_STYLES.backdrop;

  modal.innerHTML = `
    <div style="${MODAL_STYLES.container}">
      <!-- Header -->
      <div style="${MODAL_STYLES.header}">
        <div>
          <h2 style="margin: 0; font-size: 24px; font-weight: 600;">🛡️ Pre-Check</h2>
          <p style="margin: 4px 0 0 0; opacity: 0.9; font-size: 14px;">Deployment validation</p>
        </div>
        <button onclick="document.getElementById('${modalId}').remove()" style="${MODAL_STYLES.closeButton}" onmouseover="this.style.background='rgba(255,255,255,0.3)'" onmouseout="this.style.background='rgba(255,255,255,0.2)'">
          ✕
        </button>
      </div>

      <!-- Status Section -->
      <div style="
        padding: 24px;
        background: ${statusColor};
        color: white;
        border-left: 4px solid ${statusColor};
      ">
        <div style="font-size: 18px; font-weight: 600; margin-bottom: 4px;">
          ${statusIcon} ${statusText}
        </div>
        <div style="font-size: 13px; opacity: 0.9;">
          Coverage: ${summary.coverage}% (${summary.existing}/${summary.total} components)
        </div>
      </div>

      <!-- Stats Grid -->
      <div style="
        padding: 24px;
        background: #f9fafb;
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 16px;
        border-bottom: 1px solid #e5e7eb;
      ">
        <div style="text-align: center;">
          <div style="font-size: 24px; font-weight: 600; color: #667eea;">${summary.total}</div>
          <div style="font-size: 12px; color: #666; margin-top: 4px;">Total Components</div>
        </div>
        <div style="text-align: center;">
          <div style="font-size: 24px; font-weight: 600; color: #10b981;">✓ ${summary.existing}</div>
          <div style="font-size: 12px; color: #666; margin-top: 4px;">In Production</div>
        </div>
        <div style="text-align: center;">
          <div style="font-size: 24px; font-weight: 600; color: #ef4444;">✕ ${summary.missing}</div>
          <div style="font-size: 12px; color: #666; margin-top: 4px;">Missing</div>
        </div>
      </div>

      <!-- Recommendations -->
      ${recommendations.length > 0 ? `
        <div style="padding: 24px; border-bottom: 1px solid #e5e7eb;">
          <h3 style="margin: 0 0 16px 0; font-size: 16px; font-weight: 600; color: #333;">
            📋 Recommendations
          </h3>
          ${recommendations.map(rec => `
            <div style="
              padding: 12px;
              margin-bottom: 12px;
              border-radius: 6px;
              background: ${rec.severity === 'success' ? '#ecfdf5' : '#fef2f2'};
              border-left: 4px solid ${rec.severity === 'success' ? '#10b981' : '#ef4444'};
            ">
              <div style="
                font-weight: 600;
                color: ${rec.severity === 'success' ? '#10b981' : '#ef4444'};
                margin-bottom: 4px;
              ">
                ${rec.message}
              </div>
              <div style="font-size: 13px; color: #666;">
                ${rec.action}
              </div>
            </div>
          `).join('')}
        </div>
      ` : ''}

      <!-- Components List -->
      <div style="padding: 24px;">
        ${missingComponents.length > 0 ? `
          <div style="margin-bottom: 24px;">
            <h4 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #ef4444;">
              ✕ Missing Components (${missingComponents.length})
            </h4>
            ${missingComponents.map(comp => `
              <div style="
                padding: 12px;
                background: #fef2f2;
                border: 1px solid #fecaca;
                border-radius: 6px;
                margin-bottom: 8px;
                font-size: 14px;
              ">
                <div style="font-weight: 600; color: #991b1b;">${escapeHtml(comp.name)}</div>
                <div style="font-size: 12px; color: #dc2626; margin-top: 4px;">
                  Type: ${comp.type}
                </div>
              </div>
            `).join('')}
          </div>
        ` : ''}

        ${existingComponents.length > 0 ? `
          <div>
            <h4 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #10b981;">
              ✓ Deployed Components (${existingComponents.length})
            </h4>
            ${existingComponents.slice(0, 5).map(comp => `
              <div style="
                padding: 12px;
                background: #ecfdf5;
                border: 1px solid #a7f3d0;
                border-radius: 6px;
                margin-bottom: 8px;
                font-size: 13px;
              ">
                <div style="font-weight: 600; color: #047857;">${escapeHtml(comp.name)}</div>
                <div style="font-size: 11px; color: #059669; margin-top: 4px;">
                  ${comp.author ? `By: ${escapeHtml(comp.author)}` : ''}
                  ${comp.commit_date ? `• ${formatDate(comp.commit_date)}` : ''}
                </div>
              </div>
            `).join('')}
            ${existingComponents.length > 5 ? `
              <div style="
                text-align: center;
                padding: 12px;
                color: #666;
                font-size: 13px;
              ">
                +${existingComponents.length - 5} more components...
              </div>
            ` : ''}
          </div>
        ` : ''}
      </div>

      <!-- Footer -->
      <div style="
        padding: 16px 24px;
        background: #f9fafb;
        border-top: 1px solid #e5e7eb;
        text-align: right;
        border-radius: 0 0 12px 12px;
      ">
        <button onclick="document.getElementById('${modalId}').remove()" style="
          background: #667eea;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
          transition: background 0.2s;
        " onmouseover="this.style.background='#764ba2'" onmouseout="this.style.background='#667eea'">
          Close
        </button>
      </div>
    </div>
  `;

  return modal;
}