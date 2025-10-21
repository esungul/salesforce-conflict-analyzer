export function createAnalyzeModal(options = {}) {
  const { onSubmit, onCancel } = options;

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');

  // Create form element
  const form = document.createElement('form');
  form.className = 'modal-form';
  form.id = 'analyze-form';

  // Create header
  const header = document.createElement('div');
  header.className = 'modal-header';
  header.innerHTML = `
    <h2 id="modal-title">Analyze Online</h2>
    <button class="modal-close" aria-label="Close" type="button">×</button>
  `;

  // Create textarea 1
  const group1 = document.createElement('div');
  group1.className = 'form-group';
  group1.innerHTML = `
    <label for="user-story-names" class="form-label">User Story Names</label>
    <textarea id="user-story-names" class="form-textarea" rows="4" placeholder="US-001, US-002"></textarea>
    <p class="form-hint">Comma-separated or one per line</p>
  `;

  // Create textarea 2
  const group2 = document.createElement('div');
  group2.className = 'form-group';
  group2.innerHTML = `
    <label for="release-names" class="form-label">Release Names (Optional)</label>
    <textarea id="release-names" class="form-textarea" rows="3" placeholder="Release 1.0"></textarea>
    <p class="form-hint">Leave empty for story names only</p>
  `;

  // Create buttons
  const actions = document.createElement('div');
  actions.className = 'form-actions';
  
  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'btn btn-secondary';
  cancelBtn.id = 'cancel-btn';
  cancelBtn.textContent = 'Cancel';

  const submitBtn = document.createElement('button');
  submitBtn.type = 'submit';
  submitBtn.className = 'btn btn-primary';
  submitBtn.id = 'submit-btn';
  submitBtn.textContent = 'Analyze';

  actions.appendChild(cancelBtn);
  actions.appendChild(submitBtn);

  // Build form
  form.appendChild(group1);
  form.appendChild(group2);
  form.appendChild(actions);

  // Create modal content wrapper
  const content = document.createElement('div');
  content.className = 'modal-content';
  content.appendChild(header);
  content.appendChild(form);

  modal.appendChild(content);

  // Events
  const closeBtn = header.querySelector('.modal-close');

  const handleClose = () => {
    if (onCancel) onCancel();
    modal.remove();
    backdrop.remove();
  };

  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    handleClose();
  });
  
  cancelBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    handleClose();
  });
  
  // Prevent modal clicks from propagating to backdrop
  modal.addEventListener('click', (e) => {
    e.stopPropagation();
  });
  
  // Only backdrop clicks close it
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) {
      handleClose();
    }
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    e.stopPropagation();

    const storyVal = form.querySelector('#user-story-names').value.trim();
    const releaseVal = form.querySelector('#release-names').value.trim();

    const stories = storyVal.split(/[,\n]+/).map(s => s.trim()).filter(Boolean);
    const releases = releaseVal.split(/[,\n]+/).map(s => s.trim()).filter(Boolean);

    if (stories.length === 0 && releases.length === 0) {
      alert('Enter at least one story or release name');
      return;
    }

    if (onSubmit) {
      onSubmit({
        userStoryNames: stories.length > 0 ? stories : undefined,
        releaseNames: releases.length > 0 ? releases : undefined
      });
    }

    modal.remove();
    backdrop.remove();
  });

  injectModalCss();

  document.body.appendChild(backdrop);
  document.body.appendChild(modal);

  const firstInput = form.querySelector('#user-story-names');
  if (firstInput) setTimeout(() => firstInput.focus(), 100);

  return modal;
}

function injectModalCss() {
  const style = document.querySelector('style[data-modal]');
  if (style) return;
  
  const css = `
    .modal-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      animation: fadeIn 0.3s ease;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .modal {
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      max-width: 500px;
      width: 90%;
      max-height: 90vh;
      overflow-y: auto;
      animation: slideUp 0.3s ease;
    }

    @keyframes slideUp {
      from { transform: translateY(20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }

    .modal-content {
      padding: 32px;
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
    }

    .modal-header h2 {
      margin: 0;
      font-size: 20px;
      font-weight: 600;
      color: #1d1d1f;
    }

    .modal-close {
      background: none;
      border: none;
      font-size: 24px;
      color: #86868b;
      cursor: pointer;
      padding: 0;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 6px;
      transition: all 0.3s ease;
    }

    .modal-close:hover {
      background: #f5f5f7;
      color: #1d1d1f;
    }

    .modal-form {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .form-group {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .form-label {
      font-size: 14px;
      font-weight: 600;
      color: #1d1d1f;
    }

    .form-textarea {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', monospace;
      font-size: 13px;
      padding: 12px;
      border: 1px solid #d2d2d7;
      border-radius: 8px;
      color: #1d1d1f;
      resize: vertical;
      transition: all 0.3s ease;
    }

    .form-textarea:focus {
      outline: none;
      border-color: #0071e3;
      box-shadow: 0 0 0 2px rgba(0, 113, 227, 0.1);
    }

    .form-hint {
      font-size: 12px;
      color: #86868b;
      margin: 0;
    }

    .form-actions {
      display: flex;
      gap: 12px;
      justify-content: flex-end;
      margin-top: 12px;
    }

    .btn {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 14px;
      padding: 10px 20px;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 600;
      transition: all 0.3s ease;
    }

    .btn-primary {
      background: #0071e3;
      color: white;
    }

    .btn-primary:hover {
      background: #0056b3;
    }

    .btn-primary:active {
      transform: scale(0.98);
    }

    .btn-secondary {
      background: #f5f5f7;
      color: #1d1d1f;
      border: 1px solid #d2d2d7;
    }

    .btn-secondary:hover {
      background: #e8e8ed;
    }

    @media (max-width: 600px) {
      .modal-content {
        padding: 24px;
      }

      .modal-header h2 {
        font-size: 18px;
      }

      .form-actions {
        flex-direction: column-reverse;
      }

      .btn {
        width: 100%;
      }
    }
  `;
  
  const styleEl = document.createElement('style');
  styleEl.setAttribute('data-modal', 'true');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);
}