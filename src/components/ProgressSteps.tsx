import React from 'react';
import { Upload, AlertCircle, Settings } from 'lucide-react';

interface ProgressStepsProps {
  currentStep: number;
}

const ProgressSteps: React.FC<ProgressStepsProps> = ({ currentStep }) => {
  const steps = [
    { num: 1, label: 'Upload CSV', icon: Upload },
    { num: 2, label: 'Review Conflicts', icon: AlertCircle },
    { num: 3, label: 'Configure Git', icon: Settings },
  ];

  return (
    <div className="flex items-center justify-center mb-8 gap-4">
      {steps.map((step) => {
        const Icon = step.icon;
        const isActive = currentStep === step.num;
        const isComplete = currentStep > step.num;
        
        return (
          <div key={step.num} className="flex items-center">
            <div className={`
              w-12 h-12 rounded-full flex items-center justify-center transition-all
              ${isActive ? 'bg-blue-600 text-white' : ''}
              ${isComplete ? 'bg-green-600 text-white' : ''}
              ${!isActive && !isComplete ? 'bg-slate-300 text-slate-600' : ''}
            `}>
              <Icon className="w-6 h-6" />
            </div>
            <span className={`ml-2 text-sm font-medium ${
              isActive ? 'text-blue-600' : 'text-slate-600'
            }`}>
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
};

export default ProgressSteps;