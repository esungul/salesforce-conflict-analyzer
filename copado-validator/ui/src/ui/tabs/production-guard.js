export function renderProductionGuardTab(analysisData) {
  return `
    <div class="tab-content" style="padding: 20px;">
      <h2>🛡️ Production Guard</h2>
      
      <div style="background: #f5f5f7; padding: 20px; border-radius: 8px; text-align: center;">
        <p style="font-size: 48px; margin: 0;">✅</p>
        <h3 style="margin: 10px 0;">Production Readiness Check</h3>
        <p style="color: #666; margin: 0;">Validate your story before deployment</p>
        
        <div style="background: white; padding: 20px; border-radius: 6px; margin: 20px 0; text-align: left;">
          <label style="display: block; font-weight: 600; margin-bottom: 10px;">Story ID to Validate *:</label>
          <input type="text" id="story-to-validate" 
                 placeholder="Example: US-0033343" 
                 style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid #ccc; margin-bottom: 15px; box-sizing: border-box;">
          
          <div style="display: flex; gap: 10px; flex-wrap: wrap;">
            <button onclick="checkProductionReadiness()" 
                    style="padding: 10px 16px; background: #34c759; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
              ✅ Check Readiness
            </button>
            <button onclick="fullAudit()" 
                    style="padding: 10px 16px; background: #0071e3; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
              🔐 Full Audit
            </button>
            <button onclick="requestOverride()" 
                    style="padding: 10px 16px; background: #ff9500; color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
              📝 Request Override
            </button>
          </div>
        </div>
      </div>
      
      <div id="readiness-results" style="margin-top: 20px;"></div>
    </div>
  `;
}