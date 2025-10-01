/**
 * Date Utility Functions
 * Handles date parsing, calculations, and formatting
 */

/**
 * Parses date string to Date object
 * Supports multiple date formats
 */
export const parseDate = (dateString?: string): Date | null => {
  if (!dateString) return null;
  
  try {
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
};

/**
 * Calculates how many days old a date is from now
 */
export const calculateDaysOld = (date: Date): number => {
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

/**
 * Calculates difference in days between two dates
 */
export const calculateDaysDifference = (oldDate: Date, newDate: Date): number => {
  const diffTime = Math.abs(newDate.getTime() - oldDate.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

/**
 * Formats date to readable string
 */
export const formatDate = (date: Date): string => {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};