import { useState } from 'react';
import { Upload, AlertCircle, CheckCircle, GitBranch, FileText, Settings } from 'lucide-react';

interface CSVData {
  userStory: string;
  metadataName: string;
  lastCommitDate?: string;
  developer?: string;
  type?: string;
}

interface Conflict {
  metadataName: string;
  stories: Array<{
    storyId: string;
    commitDate: Date;
    developer?: string;
    daysOld: number;
    isLatest: boolean;
  }>;
  riskLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  daysBehind: number;
}

interface GitConfig {
  provider: 'github' | 'gitlab' | 'bitbucket';
  orgName: string;
  repoName: string;
  branchPrefix: string;
}

const App = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [gitConfig, setGitConfig] = useState<GitConfig>({
    provider: 'github',
    orgName: '',
    repoName: '',
    branchPrefix: 'feature/'
  });

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n');
      const headers = lines[0].split(',').map(h => h.trim());
      
      const getColumnIndex = (possibleNames: string[]) => {
        for (const name of possibleNames) {
          const idx = headers.findIndex(h => h === name || h.includes(name));
          if (idx !== -1) return idx;
        }
        return -1;
      };

      const storyIdx = getColumnIndex(['copado__User_Story__r.Name', 'User_Story__r.Name', 'userStory']);
      const metadataIdx = getColumnIndex(['copado__Metadata_API_Name__c', 'Metadata_API_Name__c', 'metadataName']);
      const dateIdx = getColumnIndex(['copado__Last_Commit_Date__c', 'Last_Commit_Date__c', 'lastCommitDate']);
      const developerIdx = getColumnIndex(['copado__User_Story__r.copado__Developer__r.Name', 'Developer__r.Name', 'developer']);
      const typeIdx = getColumnIndex(['copado__Type__c', 'Type__c', 'type']);

      if (storyIdx === -1 || metadataIdx === -1) {
        alert('CSV must contain User Story and Metadata columns');
        return;
      }
      
      const data = lines.slice(1)
        .filter(line => line.trim())
        .map(line => {
          const values = line.split(',').map(v => v.trim());
          return {
            userStory: values[storyIdx] || '',
            metadataName: values[metadataIdx] || '',
            lastCommitDate: dateIdx !== -1 ? values[dateIdx] : undefined,
            developer: developerIdx !== -1 ? values[developerIdx] : undefined,
            type: typeIdx !== -1 ? values[typeIdx] : undefined
          };
        })
        .filter(row => row.userStory && row.metadataName);

      if (data.length === 0) {
        alert('No valid data found in CSV');
        return;
      }

      detectConflicts(data);
      setCurrentStep(2);
    };
    reader.readAsText(file);
  };

  const detectConflicts = (data: CSVData[]) => {
    const metadataMap = new Map<string, CSVData[]>();
    
    data.forEach(record => {
      if (!metadataMap.has(record.metadataName)) {
        metadataMap.set(record.metadataName, []);
      }
      metadataMap.get(record.metadataName)!.push(record);
    });

    const foundConflicts: Conflict[] = [];
    
    metadataMap.forEach((records, metadataName) => {
      const uniqueStories = new Map<string, CSVData>();
      
      records.forEach(record => {
        if (!uniqueStories.has(record.userStory)) {
          uniqueStories.set(record.userStory, record);
        }
      });

      if (uniqueStories.size >= 2) {
        const stories = Array.from(uniqueStories.values()).map(record => {
          const commitDate = record.lastCommitDate 
            ? new Date(record.lastCommitDate) 
            : new Date();
          const daysOld = Math.floor((Date.now() - commitDate.getTime()) / (1000 * 60 * 60 * 24));
          
          return {
            storyId: record.userStory,
            commitDate,
            developer: record.developer,
            daysOld,
            isLatest: false
          };
        }).sort((a, b) => b.commitDate.getTime() - a.commitDate.getTime());

        if (stories.length > 0) {
          stories[0].isLatest = true;
        }

        const daysBehind = stories.length > 1 
          ? Math.floor((stories[0].commitDate.getTime() - stories[stories.length - 1].commitDate.getTime()) / (1000 * 60 * 60 * 24))
          : 0;

        const riskLevel: 'HIGH' | 'MEDIUM' | 'LOW' = 
          stories.length >= 3 && daysBehind >= 5 ? 'HIGH' :
          daysBehind >= 5 ? 'MEDIUM' : 'LOW';

        foundConflicts.push({
          metadataName,
          stories,
          riskLevel,
          daysBehind
        });
      }
    });

    setConflicts(foundConflicts.sort((a, b) => {
      const order = { HIGH: 0, MEDIUM: 1, LOW: 2 };
      return order[a.riskLevel] - order[b.riskLevel];
    }));
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
        <div className="flex items-center justify-center mb-8 gap-4">
          {[
            { num: 1, label: 'Upload CSV', icon: Upload },
            { num: 2, label: 'Review Conflicts', icon: AlertCircle },
            { num: 3, label: 'Configure Git', icon: Settings },
          ].map((step) => {
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
                <span className={`ml-2 text-sm font-medium ${isActive ? 'text-blue-600' : 'text-slate-600'}`}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>

        <div className="bg-white rounded-lg shadow-md p-8">
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-slate-900 mb-2">
                  Upload Copado Metadata CSV
                </h2>
                <p className="text-slate-600">
                  Export your user story metadata and upload it here
                </p>
              </div>

              <label className="block border-2 border-dashed border-slate-300 rounded-lg p-12 text-center cursor-pointer hover:border-blue-400 hover:bg-slate-50 transition-colors">
                <Upload className="w-16 h-16 mx-auto mb-4 text-slate-400" />
                <p className="text-lg font-medium text-slate-700 mb-2">
                  Drop your CSV file here or click to browse
                </p>
                <p className="text-sm text-slate-500">
                  Accepts .csv files only
                </p>
                <input 
                  type="file" 
                  accept=".csv" 
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </label>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex gap-3">
                  <FileText className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-medium text-blue-900 mb-1">Required Columns:</p>
                    <p className="text-blue-700">User Story Name, Metadata Name, Last Commit Date (optional)</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {currentStep === 2 && (
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
                    {conflicts.filter(c => c.riskLevel === 'HIGH').length} High
                  </span>
                  <span className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm font-medium">
                    {conflicts.filter(c => c.riskLevel === 'MEDIUM').length} Medium
                  </span>
                  <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                    {conflicts.filter(c => c.riskLevel === 'LOW').length} Low
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
                    <div key={idx} className="border border-slate-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="font-semibold text-slate-900 text-lg">{conflict.metadataName}</h3>
                          <p className="text-sm text-slate-600 mt-1">
                            {conflict.stories.length} stories • {conflict.daysBehind} days gap
                          </p>
                        </div>
                        <span className={`
                          px-3 py-1 rounded-full text-sm font-medium
                          ${conflict.riskLevel === 'HIGH' ? 'bg-red-100 text-red-700' : ''}
                          ${conflict.riskLevel === 'MEDIUM' ? 'bg-yellow-100 text-yellow-700' : ''}
                          ${conflict.riskLevel === 'LOW' ? 'bg-green-100 text-green-700' : ''}
                        `}>
                          {conflict.riskLevel} RISK
                        </span>
                      </div>

                      <div className="space-y-2">
                        {conflict.stories.map((story, sIdx) => (
                          <div key={sIdx} className={`
                            flex items-center justify-between p-3 rounded
                            ${story.isLatest ? 'bg-green-50 border border-green-200' : 'bg-slate-50'}
                          `}>
                            <div className="flex items-center gap-3 flex-wrap">
                              <span className="font-mono text-sm font-medium">{story.storyId}</span>
                              {story.developer && (
                                <span className="text-sm text-slate-600">{story.developer}</span>
                              )}
                              <span className="text-sm text-slate-500">
                                {story.daysOld} days ago
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
                  ))}
                </div>
              )}

              <button
                onClick={() => setCurrentStep(1)}
                className="w-full bg-slate-200 text-slate-700 py-3 rounded-lg hover:bg-slate-300 font-medium transition-colors"
              >
                Upload Different CSV
              </button>
            </div>
          )}

          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-semibold text-slate-900 mb-2">
                  Configure Git Repository
                </h2>
                <p className="text-slate-600">
                  Set up your Git provider to generate verification links
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Git Provider
                  </label>
                  <select
                    value={gitConfig.provider}
                    onChange={(e) => setGitConfig({...gitConfig, provider: e.target.value as any})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="github">GitHub</option>
                    <option value="gitlab">GitLab</option>
                    <option value="bitbucket">Bitbucket</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Organization Name
                  </label>
                  <input
                    type="text"
                    value={gitConfig.orgName}
                    onChange={(e) => setGitConfig({...gitConfig, orgName: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="your-org"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Repository Name
                  </label>
                  <input
                    type="text"
                    value={gitConfig.repoName}
                    onChange={(e) => setGitConfig({...gitConfig, repoName: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="salesforce-repo"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Branch Prefix
                  </label>
                  <input
                    type="text"
                    value={gitConfig.branchPrefix}
                    onChange={(e) => setGitConfig({...gitConfig, branchPrefix: e.target.value})}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="feature/"
                  />
                </div>
              </div>

              {gitConfig.orgName && gitConfig.repoName && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-green-900">Configuration Complete!</p>
                      <p className="text-sm text-green-700 mt-1">
                        Git links will be generated for all conflicts
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={() => setCurrentStep(2)}
                className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 font-medium transition-colors"
              >
                Back to Conflicts
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
