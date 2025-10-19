// ui/src/api/endpoints.js
import { postForm, postJson, validateAnalysisShape, normalizeAnalysis } from './client.js';
import { FEATURES } from '../config.js';

/**
 * Online Salesforce analysis
 * Accepts:
 *  - By Release Name: { releaseNames: string }  // single string
 *  - By User Stories: { userStoryNames: string[] } // array of strings
 *  - Optional: repo, branch (passed through if provided)
 */
export async function analyzeFromSalesforce({ repo, branch, filters }) {
  const rn = filters?.releaseNames ?? [];
  const us = filters?.userStoryNames ?? [];

  // Build payload that matches your examples exactly
  const payload = {
    ...(repo ? { repo } : {}),
    ...(branch ? { branch } : {}),
    ...(rn.length === 1 ? { releaseNames: rn[0] } : {}),     // single string only
    ...(us.length > 0 ? { userStoryNames: us } : {}),        // array
  };

  if (!payload.releaseNames && !payload.userStoryNames) {
    throw new Error('Provide releaseNames (single string) or userStoryNames (array).');
  }

  const data = await postJson('/api/analyze-sf', payload);
  validateAnalysisShape(data);
  return normalizeAnalysis(data);
}

/**
 * CSV upload analysis
 * Matches: curl -X POST /api/analyze -F file=@/path/to/export.csv
 */
export async function analyzeFromCsv({ file }) {
  if (!file) throw new Error('Please select a CSV file.');
  const fd = new FormData();
  fd.append('file', file); // <-- exact field name per your backend example

  const data = await postForm('/api/analyze', fd);
  validateAnalysisShape(data);
  return normalizeAnalysis(data);
}
