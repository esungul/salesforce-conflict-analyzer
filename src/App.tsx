import React, { useState } from 'react';
import { Upload, AlertCircle, Settings, GitBranch } from 'lucide-react';
import { Conflict, GitConfig } from './types';
import { parseCopadoCSV } from './services/csvParser';
import { detectConflicts } from './services/conflictDetector';
//import UploadStep from './components/UploadStep';
//import ConflictStep from './components/ConflictStep';
//import GitConfigStep from './components/GitConfigStep';
//import ProgressSteps from './components/ProgressSteps';

const App = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [gitConfig, setGitConfig] = useState<GitConfig>({
    provider: 'github',
    orgName: '',
    repoName: '',
    branchPrefix: 'feature/'
  });

  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const { data, errors } = parseCopadoCSV(text);
      
      if (errors.length > 0) {
        alert(`Parse errors:\n${errors.join('\n')}`);
      }
      
      if (data.length === 0) {
        alert('No valid data found in CSV');
        return;
      }

      const foundConflicts = detectConflicts(data);
      setConflicts(foundConflicts);
      setCurrentStep(2);
    };
    
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <GitBranch className="w-8 h-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-slate-900">
                  Salesforce Conflict Analyzer
                </h1>
                <p className="text-sm text-slate-600">
                  Detect and resolve deployment conflicts
                </p>
              </div>
            </div>
            {currentStep === 2 && (
              <button
                onClick={() => setCurrentStep(3)}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                <Settings className="w-4 h-4" />
                Configure Git Links
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <ProgressSteps currentStep={currentStep} />

        <div className="bg-white rounded-lg shadow-md p-8">
          {currentStep === 1 && (
            <UploadStep onFileUpload={handleFileUpload} />
          )}
          
          {currentStep === 2 && (
            <ConflictStep 
              conflicts={conflicts} 
              onBack={() => setCurrentStep(1)} 
            />
          )}
          
          {currentStep === 3 && (
            <GitConfigStep
              config={gitConfig}
              onConfigChange={setGitConfig}
              onBack={() => setCurrentStep(2)}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default App;