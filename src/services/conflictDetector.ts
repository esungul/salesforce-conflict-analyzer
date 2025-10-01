import { CopadoMetadata, Conflict, ConflictStory } from '../types';
import { calculateDaysOld, calculateDaysDifference, parseDate } from '../utils/dateHelpers';

/**
 * Conflict Detection Service
 * Identifies components modified by multiple user stories
 * Calculates risk levels based on time gaps and story count
 */

/**
 * Groups metadata by component name and identifies conflicts
 * 
 * @param data - Array of parsed Copado metadata
 * @param minimumStories - Minimum stories to constitute a conflict (default: 2)
 * @returns Array of detected conflicts sorted by risk level
 */
export const detectConflicts = (
  data: CopadoMetadata[],
  minimumStories: number = 2
): Conflict[] => {
  // Group by metadata name
  const metadataMap = groupByMetadata(data);
  
  // Find conflicts
  const conflicts: Conflict[] = [];
  
  metadataMap.forEach((records, metadataName) => {
    const uniqueStories = getUniqueStories(records);
    
    if (uniqueStories.size >= minimumStories) {
      const conflict = buildConflict(metadataName, Array.from(uniqueStories.values()));
      conflicts.push(conflict);
    }
  });
  
  return sortConflictsByRisk(conflicts);
};

/**
 * Groups metadata records by component name
 */
const groupByMetadata = (
  data: CopadoMetadata[]
): Map<string, CopadoMetadata[]> => {
  const map = new Map<string, CopadoMetadata[]>();
  
  data.forEach(record => {
    const key = record.metadataName;
    if (!map.has(key)) {
      map.set(key, []);
    }
    map.get(key)!.push(record);
  });
  
  return map;
};

/**
 * Gets unique user stories with their latest commit for the component
 */
const getUniqueStories = (
  records: CopadoMetadata[]
): Map<string, CopadoMetadata> => {
  const storyMap = new Map<string, CopadoMetadata>();
  
  records.forEach(record => {
    const storyId = record.userStory;
    
    if (!storyMap.has(storyId)) {
      storyMap.set(storyId, record);
    } else {
      // Keep record with latest commit
      const existing = storyMap.get(storyId)!;
      const existingDate = parseDate(existing.lastCommitDate);
      const currentDate = parseDate(record.lastCommitDate);
      
      if (currentDate && (!existingDate || currentDate > existingDate)) {
        storyMap.set(storyId, record);
      }
    }
  });
  
  return storyMap;
};

/**
 * Builds conflict object from metadata records
 */
const buildConflict = (
  metadataName: string,
  records: CopadoMetadata[]
): Conflict => {
  const stories = buildConflictStories(records);
  const newestStory = stories[0];
  const oldestStory = stories[stories.length - 1];
  
  const daysBehind = calculateDaysDifference(
    oldestStory.commitDate,
    newestStory.commitDate
  );
  
  const riskLevel = calculateRiskLevel(stories.length, daysBehind);
  
  return {
    metadataName,
    type: records[0].type,
    stories,
    latestStory: newestStory.storyId,
    latestCommitDate: newestStory.commitDate,
    riskLevel,
    daysBehind
  };
};

/**
 * Converts metadata records to ConflictStory objects
 */
const buildConflictStories = (
  records: CopadoMetadata[]
): ConflictStory[] => {
  const now = new Date();
  
  const stories = records.map(record => {
    const commitDate = parseDate(record.lastCommitDate) || now;
    const daysOld = calculateDaysOld(commitDate);
    
    return {
      storyId: record.userStory,
      commitDate,
      developer: record.developer,
      daysOld,
      isLatest: false
    };
  });
  
  // Sort by date (newest first)
  stories.sort((a, b) => b.commitDate.getTime() - a.commitDate.getTime());
  
  // Mark latest
  if (stories.length > 0) {
    stories[0].isLatest = true;
  }
  
  return stories;
};

/**
 * Calculates risk level based on story count and time gap
 * 
 * Risk Matrix:
 * - HIGH: 3+ stories AND 5+ days gap, OR 2+ stories AND 10+ days gap
 * - MEDIUM: 3+ stories OR 5+ days gap
 * - LOW: Everything else
 */
const calculateRiskLevel = (
  storyCount: number,
  daysBehind: number
): 'HIGH' | 'MEDIUM' | 'LOW' => {
  if ((storyCount >= 3 && daysBehind >= 5) || (storyCount >= 2 && daysBehind >= 10)) {
    return 'HIGH';
  }
  
  if (storyCount >= 3 || daysBehind >= 5) {
    return 'MEDIUM';
  }
  
  return 'LOW';
};

/**
 * Sorts conflicts by risk level and days behind
 */
const sortConflictsByRisk = (conflicts: Conflict[]): Conflict[] => {
  const riskOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  
  return conflicts.sort((a, b) => {
    if (riskOrder[a.riskLevel] !== riskOrder[b.riskLevel]) {
      return riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
    }
    return b.daysBehind - a.daysBehind;
  });
};

/**
 * Gets summary statistics for conflicts
 */
export const getConflictStats = (conflicts: Conflict[]) => {
  return {
    total: conflicts.length,
    high: conflicts.filter(c => c.riskLevel === 'HIGH').length,
    medium: conflicts.filter(c => c.riskLevel === 'MEDIUM').length,
    low: conflicts.filter(c => c.riskLevel === 'LOW').length,
    totalStories: new Set(conflicts.flatMap(c => c.stories.map(s => s.storyId))).size,
    maxDaysBehind: Math.max(...conflicts.map(c => c.daysBehind), 0)
  };
};