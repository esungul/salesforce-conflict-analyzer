// src/controllers/analyzeOnline.js
import { analyzeStories } from '../api/endpoints.js';

const asArray = v => {
  if (Array.isArray(v)) return v.map(s => String(s).trim()).filter(Boolean);
  if (v == null || v === '') return [];
  return String(v).split(',').map(s => s.trim()).filter(Boolean);
};

/**
 * Run the unified analysis and return UI-ready structures.
 * NOTE: This function is pure — it does NOT touch globals. main.js commits results & renders.
 */
export async function openAnalyzeOnlineFlow({ userStoryNames, releaseNames, configJsonPath } = {}) {
  const userStoryNamesArr = asArray(userStoryNames);
  const releaseNamesArr   = asArray(releaseNames);

  if (!userStoryNamesArr.length && !releaseNamesArr.length) {
    throw new Error('Please provide userStoryNames or releaseNames.');
  }

  const { summary, component_conflicts, story_conflicts, raw } =
    await analyzeStories({
      userStoryNames: userStoryNamesArr,
      releaseNames: releaseNamesArr,
      configJsonPath
    });

  // Build a story set (prefer backend list; else derive from conflicts)
  const storySet = new Set();
  if (Array.isArray(raw?.all_stories) && raw.all_stories.length) {
    raw.all_stories.forEach(s => storySet.add(s.id || s.name || s.key));
  } else {
    component_conflicts.forEach(c =>
      (c.involved_stories || []).forEach(s => storySet.add(s.id || s.name || s.story_id || s.jira_key))
    );
  }

  const conflictedIds = new Set(
    (story_conflicts || []).flatMap(p => [String(p.story1_id), String(p.story2_id)])
  );
  const allStoryIds  = [...storySet].filter(Boolean);
  const safeStoryIds = allStoryIds.filter(id => !conflictedIds.has(String(id)));

  const STORIES_DATA = {
    _metadata: {
      totalStoriesUnique: summary?.stories ?? allStoryIds.length,
      conflicts: summary?.component_conflicts ?? component_conflicts.length,
      safe: summary?.stories_safe ?? safeStoryIds.length,
      blocked: summary?.stories_blocked ?? 0
    },
    all_stories:
      Array.isArray(raw?.all_stories) && raw.all_stories.length
        ? raw.all_stories
        : safeStoryIds.map(id => ({ id }))
  };

  return {
    ANALYSIS: raw,
    STORIES_DATA,
    CONFLICTS_DATA: component_conflicts,
    SUMMARY: summary
  };
}
