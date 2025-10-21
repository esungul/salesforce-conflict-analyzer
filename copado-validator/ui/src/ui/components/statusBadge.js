// ui/src/ui/components/statusBadge.js

/**
 * Create a status badge with color coding
 * @param {string} status - Status value
 * @param {Object} options - Configuration
 * @returns {HTMLElement} Badge element
 */
export function createStatusBadge(status, options = {}) {
  const badge = document.createElement('span');
  badge.className = 'status-badge';

  const statusMap = {
    'back-promoted': { label: 'Back Promoted', color: '#FF3B30', bg: '#ffcccb' },
    'potential-conflict': { label: 'Potential Conflict', color: '#FF9500', bg: '#ffd4a3' },
    'behind-prod': { label: 'Behind Prod', color: '#FF3B30', bg: '#ffcccb' },
    'clean': { label: 'Clean', color: '#34C759', bg: '#d1f4e0' },
    'safe': { label: 'Safe', color: '#34C759', bg: '#d1f4e0' },
    'conflict': { label: 'Conflict', color: '#FF9500', bg: '#ffd4a3' },
    'blocked': { label: 'Blocked', color: '#FF3B30', bg: '#ffcccb' },
    'ready': { label: 'Ready', color: '#34C759', bg: '#d1f4e0' },
  };

  const normalized = status?.toLowerCase().replace(/\s+/g, '-') || 'unknown';
  const config = statusMap[normalized] || { label: status, color: '#86868b', bg: '#f5f5f7' };

  badge.textContent = config.label;
  badge.style.backgroundColor = config.bg;
  badge.style.color = config.color;

  if (options.small) {
    badge.classList.add('badge-small');
  }

  injectBadgeCss();
  return badge;
}

const injectBadgeCss = (() => {
  let done = false;
  return () => {
    if (done) return;
    done = true;

    const css = `
      .status-badge {
        display: inline-block;
        padding: 4px 12px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: 600;
        white-space: nowrap;
        transition: all 0.3s ease;
      }

      .status-badge.badge-small {
        padding: 2px 8px;
        font-size: 11px;
      }
    `;

    document.head.appendChild(Object.assign(document.createElement('style'), { textContent: css }));
  };
})();