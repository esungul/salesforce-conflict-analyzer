import React from 'react';
import { CheckCircle } from 'lucide-react';
import { GitConfig } from '../types';

interface GitConfigStepProps {
  config: GitConfig;
  onConfigChange: (config: GitConfig) => void;
  onBack: () => void;
}

const GitConfigStep: React.FC<GitConfigStepProps> = ({ 
  config, 
  onConfigChange, 
  onBack 
}) => {
  const handleChange = (field: keyof GitConfig, value: string) => {
    onConfigChange({ ...config, [field]: value });
  };

  const isConfigComplete = config.orgName && config.repoName;

  return (
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
            value={config.provider}
            onChange={(e) => handleChange('provider', e.target.value)}
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
            value={config.orgName}
            onChange={(e) => handleChange('orgName', e.target.value)}
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
            value={config.repoName}
            onChange={(e) => handleChange('repoName', e.target.value)}
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
            value={config.branchPrefix}
            onChange={(e) => handleChange('branchPrefix', e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="feature/"
          />
        </div>
      </div>

      {isConfigComplete && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex gap-2">
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-green-900">
                Configuration Complete!
              </p>
              <p className="text-sm text-green-700 mt-1">
                Git links will be generated for all conflicts
              </p>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={onBack}
        className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 font-medium transition-colors"
      >
        Back to Conflicts
      </button>
    </div>
  );
};

export default GitConfigStep;