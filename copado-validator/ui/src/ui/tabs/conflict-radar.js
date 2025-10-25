export function renderConflictRadarTab(analysisData) {
  return `
    <div class="tab-content" style="padding: 20px;">
      <h2>⚠️ Conflict Radar</h2>
      
      <div style="background: #f5f5f7; padding: 20px; border-radius: 8px; text-align: center;">
        <p style="font-size: 48px; margin: 0;">🔍</p>
        <h3 style="margin: 10px 0;">Scan for Conflicts</h3>
        <p style="color: #666; margin: 0;">Enter components below to check for pipeline conflicts</p>
        
        <div style="background: white; padding: 20px; border-radius: 6px; margin: 20px 0; text-align: left;">
          <label style="display: block; font-weight: 600; margin-bottom: 10px;">Component (optional):</label>
          <input type="text" id="conflict-component" 
                 placeholder="Component name" 
                 style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid #ccc; margin-bottom: 15px; box-sizing: border-box;">
          
          <label style="display: block; font-weight: 600; margin-bottom: 10px;">Story ID (optional):</label>
          <input type="text" id="conflict-story" 
                 placeholder="Story ID" 
                 style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid #ccc; margin-bottom: 15px; box-sizing: border-box;">
          
          <label style="display: block; font-weight: 600; margin-bottom: 10px;">Environment:</label>
          <select id="conflict-env" style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid #ccc; box-sizing: border-box;">
            <option value="dev">🔧 Development</option>
            <option value="qa">🧪 QA</option>
            <option value="prod">🚀 Production</option>
          </select>
          
          <div style="display: flex; gap: 10px; margin-top: 15px; flex-wrap: wrap;">
            <button onclick="scanConflicts()" 
                    style="padding: 10px 16px; background: #ff6b35; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
              🔍 Scan Conflicts
            </button>
            <button onclick="compareVersions()" 
                    style="padding: 10px 16px; background: #666; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
              📊 Compare Versions
            </button>
          </div>
        </div>
      </div>
      
      <div id="conflict-results" style="margin-top: 20px;"></div>
    </div>
  `;
}