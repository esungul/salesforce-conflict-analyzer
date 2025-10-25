// src/ui/tabs/developer-utils.js - COMPLETE FILE

import { renderConflictRadarTab } from './conflict-radar.js';

export function getStoryStatus(story, analysis) {
  if (!story || !analysis) return 'unknown';
  
  const isBlocked = analysis.blocked_stories?.some(blocked => 
    blocked.id === story.id || blocked.name === story.name
  );
  
  const hasConflicts = analysis.component_conflicts?.some(conflict =>
    conflict.stories?.includes(story.id) || conflict.stories?.includes(story.name)
  );
  
  if (isBlocked) return 'blocked';
  if (hasConflicts) return 'conflict';
  return 'safe';
}

export function getStatusText(status) {
  const statusMap = {
    safe: 'Ready to Deploy',
    conflict: 'Has Conflicts', 
    blocked: 'Blocked',
    unknown: 'Unknown'
  };
  return statusMap[status] || 'Unknown';
}

export function getUniqueComponents(analysis) {
  if (!analysis) return [];
  
  const components = new Set();
  
  analysis.all_stories?.forEach(story => {
    (story.components || []).forEach(comp => {
      if (comp && typeof comp === 'string') {
        components.add(comp);
      }
    });
  });
  
  analysis.component_conflicts?.forEach(conflict => {
    if (conflict.componentName) {
      components.add(conflict.componentName);
    }
  });
  
  return Array.from(components);
}

export function calculateReadinessScore(analysis) {
  if (!analysis) return 0;
  
  const stories = analysis.all_stories || [];
  const blockedStories = analysis.blocked_stories || [];
  const conflicts = analysis.component_conflicts || [];
  
  if (stories.length === 0) return 0;
  
  const blockedScore = blockedStories.length > 0 ? 0 : 40;
  const conflictScore = conflicts.length > 0 ? 0 : 40;
  const storyScore = (stories.length - blockedStories.length) / stories.length * 20;
  
  return Math.min(100, Math.round(blockedScore + conflictScore + storyScore));
}

export function renderEmptyState(tabName, message = 'Run an analysis to see data') {
  const icons = {
    'my-work': '📝',
    'conflict-radar': '⚠️',
    'production-guard': '🛡️',
    'default': '📊'
  };
  
  const icon = icons[tabName] || icons.default;
  
  return `
    <div class="empty-state-container">
      <div class="empty-state">
        <div class="empty-icon">${icon}</div>
        <h3>No Analysis Data</h3>
        <p>${message}</p>
        <button class="btn btn-primary" onclick="openAnalyzeModal()">
          Run Analysis
        </button>
      </div>
    </div>
  `;
}

export function escapeHtml(unsafe) {
  if (typeof unsafe !== 'string') return unsafe;
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function formatDate(dateString) {
  if (!dateString) return 'Unknown';
  
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    return 'Invalid date';
  }
}

export function formatCommitDate(dateString) {
  if (!dateString) return 'Unknown date';
  
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    return 'Invalid date';
  }
}