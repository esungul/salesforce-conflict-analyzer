// src/ui/components/analyzeModal.js
export function createAnalyzeModal(options = {}) {
  const { onSubmit, onCancel } = options;

  // Create modal container
  const modalContainer = document.createElement('div');
  modalContainer.className = 'analyze-modal-container';
  modalContainer.innerHTML = `
    <div class="analyze-modal-backdrop"></div>
    <div class="analyze-modal">
      <div class="analyze-modal-header">
        <h2>Analyze Stories</h2>
        <button class="analyze-modal-close">&times;</button>
      </div>
      <div class="analyze-modal-body">
        <div class="form-group">
          <label for="user-story-input">User Story Names</label>
          <textarea 
            id="user-story-input" 
            placeholder="US-001, US-002, US-003"
            rows="4"
          ></textarea>
          <div class="form-hint">Enter story names separated by commas or new lines</div>
        </div>
        <div class="form-group">
          <label for="release-input">Release Names (Optional)</label>
          <textarea 
            id="release-input" 
            placeholder="Release-1.0, Sprint-2024"
            rows="3"
          ></textarea>
          <div class="form-hint">Optional: Enter release names for batch analysis</div>
        </div>
      </div>
      <div class="analyze-modal-footer">
        <button class="btn btn-secondary cancel-btn">Cancel</button>
        <button class="btn btn-primary submit-btn">Analyze</button>
      </div>
    </div>
  `;

  // Add to DOM
  document.body.appendChild(modalContainer);

  // Get elements
  const backdrop = modalContainer.querySelector('.analyze-modal-backdrop');
  const modal = modalContainer.querySelector('.analyze-modal');
  const closeBtn = modalContainer.querySelector('.analyze-modal-close');
  const cancelBtn = modalContainer.querySelector('.cancel-btn');
  const submitBtn = modalContainer.querySelector('.submit-btn');
  const storyInput = modalContainer.querySelector('#user-story-input');
  const releaseInput = modalContainer.querySelector('#release-input');

  // Close modal function
  const closeModal = () => {
    document.body.removeChild(modalContainer);
  };

  // Handle close events
  const handleCancel = () => {
    if (onCancel) onCancel();
    closeModal();
  };

  // Event listeners
  backdrop.addEventListener('click', handleCancel);
  closeBtn.addEventListener('click', handleCancel);
  cancelBtn.addEventListener('click', handleCancel);

  // Handle submit
  submitBtn.addEventListener('click', () => {
    const storyVal = storyInput.value.trim();
    const releaseVal = releaseInput.value.trim();

    const stories = storyVal.split(/[,\n]+/).map(s => s.trim()).filter(Boolean);
    const releases = releaseVal.split(/[,\n]+/).map(s => s.trim()).filter(Boolean);

    if (stories.length === 0 && releases.length === 0) {
      alert('Please enter at least one story or release name');
      return;
    }

    closeModal();
    
    if (onSubmit) {
      onSubmit({
        userStoryNames: stories.length > 0 ? stories : undefined,
        releaseNames: releases.length > 0 ? releases : undefined
      });
    }
  });

  // Handle Enter key in textareas (Ctrl+Enter to submit)
  storyInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      submitBtn.click();
    }
  });

  releaseInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      submitBtn.click();
    }
  });

  // Focus first input
  setTimeout(() => storyInput.focus(), 100);

  // Add styles
  injectModalStyles();

  return modalContainer;
}

function injectModalStyles() {
  if (document.getElementById('analyze-modal-styles')) return;

  const styles = `
    .analyze-modal-container {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .analyze-modal-backdrop {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(4px);
    }

    .analyze-modal {
      position: relative;
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      width: 90%;
      max-width: 500px;
      max-height: 90vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      animation: modalSlideIn 0.3s ease-out;
    }

    @keyframes modalSlideIn {
      from {
        opacity: 0;
        transform: translateY(-20px) scale(0.95);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    .analyze-modal-header {
      padding: 24px 24px 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .analyze-modal-header h2 {
      margin: 0;
      font-size: 20px;
      font-weight: 600;
      color: #1d1d1f;
    }

    .analyze-modal-close {
      background: none;
      border: none;
      font-size: 24px;
      color: #86868b;
      cursor: pointer;
      width: 32px;
      height: 32px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
    }

    .analyze-modal-close:hover {
      background: #f5f5f7;
      color: #1d1d1f;
    }

    .analyze-modal-body {
      padding: 24px;
      flex: 1;
      overflow-y: auto;
    }

    .form-group {
      margin-bottom: 20px;
    }

    .form-group label {
      display: block;
      margin-bottom: 8px;
      font-size: 14px;
      font-weight: 600;
      color: #1d1d1f;
    }

    .form-group textarea {
      width: 100%;
      padding: 12px;
      border: 1px solid #d2d2d7;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', monospace;
      font-size: 14px;
      resize: vertical;
      transition: all 0.2s ease;
      box-sizing: border-box;
    }

    .form-group textarea:focus {
      outline: none;
      border-color: #0071e3;
      box-shadow: 0 0 0 3px rgba(0, 113, 227, 0.1);
    }

    .form-hint {
      margin-top: 6px;
      font-size: 12px;
      color: #86868b;
      line-height: 1.4;
    }

    .analyze-modal-footer {
      padding: 0 24px 24px;
      display: flex;
      gap: 12px;
      justify-content: flex-end;
    }

    .btn {
      padding: 10px 20px;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }

    .btn-primary {
      background: #0071e3;
      color: white;
    }

    .btn-primary:hover {
      background: #0056b3;
      transform: translateY(-1px);
    }

    .btn-secondary {
      background: #f5f5f7;
      color: #1d1d1f;
      border: 1px solid #d2d2d7;
    }

    .btn-secondary:hover {
      background: #e8e8ed;
    }

    /* Dark theme support */
    [data-theme="midnight"] .analyze-modal {
      background: #2d2d2f;
      color: white;
    }

    [data-theme="midnight"] .analyze-modal-header h2 {
      color: white;
    }

    [data-theme="midnight"] .form-group label {
      color: white;
    }

    [data-theme="midnight"] .form-group textarea {
      background: #1d1d1f;
      border-color: #424245;
      color: white;
    }

    [data-theme="midnight"] .form-group textarea:focus {
      border-color: #0071e3;
    }

    [data-theme="midnight"] .btn-secondary {
      background: #424245;
      color: white;
      border-color: #424245;
    }

    [data-theme="midnight"] .btn-secondary:hover {
      background: #515154;
    }

    [data-theme="midnight"] .analyze-modal-close {
      color: #a1a1a6;
    }

    [data-theme="midnight"] .analyze-modal-close:hover {
      background: #424245;
      color: white;
    }
  `;

  const styleElement = document.createElement('style');
  styleElement.id = 'analyze-modal-styles';
  styleElement.textContent = styles;
  document.head.appendChild(styleElement);
}