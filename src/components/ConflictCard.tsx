import React from 'react';
import { Conflict } from '../types';
import { formatDate } from '../utils/dateHelpers';

interface ConflictCardProps {
  conflict: Conflict;
}

const ConflictCard: React.FC<ConflictCardProps> = ({ conflict }) => {
  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'HIGH':
        return 'bg-red-100 text-red-700';
      case 'MEDIUM':
        return 'bg-yellow-100 text-yellow-700';
      case 'LOW':
        return 'bg-green-100 text-green-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <div className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="font-semibold text-slate-900 text-lg">
            {conflict.metadataName}
          </h3>
          {conflict.type && (
            <p className="text-sm text-slate-500 mt-1">
              Type: {conflict.type}
            </p>
          )}
          <p className="text-sm text-slate-600 mt-1">
            {conflict.stories.length} stories • {conflict.daysBehind} days gap
          </p>
        </div>
        <span className={`
          px-3 py-1 rounded-full text-sm font-medium
          ${getRiskColor(conflict.riskLevel)}
        `}>
          {conflict.riskLevel} RISK
        </span>
      </div>

      <div className="space-y-2">
        {conflict.stories.map((story, idx) => (
          <div
            key={idx}
            className={`
              flex items-center justify-between p-3 rounded
              ${story.isLatest 
                ? 'bg-green-50 border border-green-200' 
                : 'bg-slate-50'
              }
            `}
          >
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-mono text-sm font-medium">
                {story.storyId}
              </span>
              {story.developer && (
                <span className="text-sm text-slate-600">
                  {story.developer}
                </span>
              )}
              <span className="text-sm text-slate-500">
                {formatDate(story.commitDate)} ({story.daysOld} days ago)
              </span>
              {story.isLatest && (
                <span className="text-xs bg-green-600 text-white px-2 py-1 rounded font-medium">
                  LATEST
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ConflictCard;