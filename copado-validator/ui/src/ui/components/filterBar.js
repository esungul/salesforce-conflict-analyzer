// ui/src/ui/components/filterBar.js

/**
 * Create a filter bar with search, status filter, and sort options
 * @param {Object} options - Configuration
 * @param {string} options.query - Current search query
 * @param {function} options.onQueryChange - Callback when search changes
 * @param {string} options.status - Current status filter
 * @param {function} options.onStatusChange - Callback when status changes
 * @param {Array} options.statusOptions - Array of {value, label} for status filter
 * @param {string} options.sort - Current sort mode
 * @param {function} options.onSortChange - Callback when sort changes
 * @param {Array} options.sortOptions - Array of {value, label} for sort options
 * @returns {HTMLElement} Filter bar element
 */
export function createFilterBar(options = {}) {
  const {
    query = '',
    onQueryChange,
    status = 'all',
    onStatusChange,
    statusOptions = [],
    sort = 'recent',
    onSortChange,
    sortOptions = [
      { value: 'recent', label: 'Recent' },
      { value: 'name', label: 'Name' },
      { value: 'count', label: 'Count' }
    ]
  } = options;

  const container = document.createElement('div');
  container.className = 'filter-bar';

  // Search input
  const searchContainer = document.createElement('div');
  searchContainer.className = 'filter-group';

  const searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.className = 'filter-input filter-search';
  searchInput.placeholder = 'Search...';
  searchInput.value = query;

  // Add debouncing to prevent excessive filtering
  let searchTimeout;
  searchInput.addEventListener('input', (e) => {
    const value = e.target.value;
    
    // Clear previous timeout
    clearTimeout(searchTimeout);
    
    // Set new timeout with 300ms delay
    searchTimeout = setTimeout(() => {
      if (onQueryChange) onQueryChange(value);
    }, 300);
  });

  // Also prevent form submission and trigger immediate search on Enter
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Clear any pending timeout and trigger search immediately
      clearTimeout(searchTimeout);
      if (onQueryChange) onQueryChange(e.target.value);
    }
  });

  searchContainer.append(searchInput);

  // Status filter (if options provided)
  let statusSelect = null;
  if (statusOptions.length > 0) {
    const statusContainer = document.createElement('div');
    statusContainer.className = 'filter-group';

    const statusLabel = document.createElement('label');
    statusLabel.className = 'filter-label';
    statusLabel.textContent = 'Status:';

    statusSelect = document.createElement('select');
    statusSelect.className = 'filter-select';
    statusSelect.value = status;

    statusOptions.forEach(opt => {
      const option = document.createElement('option');
      option.value = opt.value;
      option.textContent = opt.label;
      statusSelect.append(option);
    });

    statusSelect.addEventListener('change', (e) => {
      if (onStatusChange) onStatusChange(e.target.value);
    });

    statusContainer.append(statusLabel, statusSelect);
    container.append(searchContainer, statusContainer);
  } else {
    container.append(searchContainer);
  }

  // Sort selector
  const sortContainer = document.createElement('div');
  sortContainer.className = 'filter-group';

  const sortLabel = document.createElement('label');
  sortLabel.className = 'filter-label';
  sortLabel.textContent = 'Sort by:';

  const sortSelect = document.createElement('select');
  sortSelect.className = 'filter-select';
  sortSelect.value = sort;

  sortOptions.forEach(opt => {
    const option = document.createElement('option');
    option.value = opt.value;
    option.textContent = opt.label;
    sortSelect.append(option);
  });

  sortSelect.addEventListener('change', (e) => {
    if (onSortChange) onSortChange(e.target.value);
  });

  sortContainer.append(sortLabel, sortSelect);
  container.append(sortContainer);

  injectFilterCss();
  return container;
}

const injectFilterCss = (() => {
  let done = false;
  return () => {
    if (done) return;
    done = true;

    const css = `
      .filter-bar {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        padding: 16px;
        background: #ffffff;
        border-radius: 8px;
        border: 1px solid #e5e5e7;
        margin-bottom: 16px;
        align-items: center;
      }

      .filter-group {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .filter-label {
        font-size: 13px;
        font-weight: 500;
        color: #86868b;
        white-space: nowrap;
      }

      .filter-input,
      .filter-select {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 13px;
        padding: 8px 12px;
        border: 1px solid #d2d2d7;
        border-radius: 6px;
        background: white;
        color: #1d1d1f;
        transition: all 0.3s ease;
      }

      .filter-input {
        min-width: 180px;
      }

      .filter-input:focus,
      .filter-select:focus {
        outline: none;
        border-color: #0071e3;
        box-shadow: 0 0 0 2px rgba(0, 113, 227, 0.1);
      }

      .filter-select {
        cursor: pointer;
        padding-right: 24px;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%231d1d1f' d='M1 1l5 5 5-5'/%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-position: right 8px center;
        appearance: none;
      }

      @media (max-width: 768px) {
        .filter-bar {
          flex-direction: column;
          gap: 8px;
        }

        .filter-input {
          width: 100%;
          min-width: unset;
        }
      }
    `;

    document.head.appendChild(Object.assign(document.createElement('style'), { textContent: css }));
  };
})();