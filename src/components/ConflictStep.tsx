import React from 'react';
import { CheckCircle } from 'lucide-react';
import { Conflict } from '../types';
import ConflictCard from './ConflictCard';

interface ConflictStepProps {
  conflicts: Conflict[];
  onBack: () => void;
}

const ConflictStep: React.FC<ConflictStepProps> = ({ conflicts, onBack }) => {
  const highCount = conflicts.filter(c => c.riskLevel === 'HIGH').length;
  const mediumCount = conflicts.filter(c => c.riskLevel === 'MEDIUM').length;
  const lowCount = conflicts.filter(c => c.riskLevel === 'LOW').length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">
            Detected Conflicts: {conflicts.length}
          </h2>
          <p className="text-slate-600">
            Components modified by multiple user stories
          </p>
        </div>
        <div className="flex gap-2">
          <span className="px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
            {highCount} High
          </span>
          <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm font-medium">
            {mediumCount} Medium
          </span>
          <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
            {lowCount} Low
          </span>
        </div>
      </div>

      {conflicts.length === 0 ? (
        <div className="text-center py-12">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            No Conflicts Detected!
          </h3>
          <p className="text-slate-600">
            All components are unique to their user stories
          </p>
        </div>
      ) : (
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {conflicts.map((conflict, idx) => (
            <ConflictCard key={idx} conflict={conflict} />
          ))}
        </div>
      )}

      <button
        onClick={onBack}
        className="w-full bg-slate-200 text-slate-700 py-3 rounded-lg hover:bg-slate-300 font-medium transition-colors"
      >
        Upload Different CSV
      </button>
    </div>
  );
};

export default ConflictStep;