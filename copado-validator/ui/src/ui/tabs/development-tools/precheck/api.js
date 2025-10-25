import { checkProductionState } from '../../../../api/endpoints.js';

export async function runPrecheckValidation(components, branch = 'master') {
  console.log('🛡️ Running pre-check validation...', { componentCount: components?.length });

  try {
    if (!components || components.length === 0) {
      throw new Error('No components to check');
    }

    const response = await checkProductionState({
      components: components.map(comp => ({
        type: comp.type || 'Component',
        name: comp.name || comp
      })),
      branch: branch
    });

    console.log('✅ Pre-check complete:', {
      total: response.components?.length,
      missing: response.components?.filter(c => !c.exists).length
    });

    const componentComps = response.components || [];
    const missing = componentComps.filter(c => !c.exists);
    const existing = componentComps.filter(c => c.exists);

    return {
      status: missing.length === 0 ? 'ready' : 'review',
      readyForDeployment: missing.length === 0,
      summary: {
        total: componentComps.length,
        existing: existing.length,
        missing: missing.length,
        coverage: componentComps.length > 0 
          ? Math.round((existing.length / componentComps.length) * 100)
          : 0
      },
      components: componentComps,
      existingComponents: existing,
      missingComponents: missing
    };
  } catch (error) {
    console.error('❌ Pre-check error:', error);
    throw error;
  }
}

export function getPrecheckRecommendations(precheckResult) {
  const recommendations = [];

  if (precheckResult.missingComponents.length > 0) {
    recommendations.push({
      severity: 'warning',
      message: `${precheckResult.missingComponents.length} component(s) missing from production`,
      action: 'Deploy missing components before proceeding'
    });
  }

  if (precheckResult.summary.coverage < 100) {
    recommendations.push({
      severity: 'warning',
      message: `Component coverage is ${precheckResult.summary.coverage}%`,
      action: 'Ensure all critical components are deployed'
    });
  }

  if (precheckResult.status === 'ready') {
    recommendations.push({
      severity: 'success',
      message: 'All components are in production',
      action: 'Ready for deployment!'
    });
  }

  return recommendations;
}