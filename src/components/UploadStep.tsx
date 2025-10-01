import React, { useState, useRef } from 'react';
import { Upload, FileText } from 'lucide-react';

interface UploadStepProps {
  onFileUpload: (file: File) => void;
}

const UploadStep: React.FC<UploadStepProps> = ({ onFileUpload }) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.csv')) {
      onFileUpload(file);
    } else {
      alert('Please upload a CSV file');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileUpload(file);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 mb-2">
          Upload Copado Metadata CSV
        </h2>
        <p className="text-slate-600">
          Export your user story metadata and upload it here
        </p>
      </div>

      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        className={`
          border-2 border-dashed rounded-lg p-12 text-center cursor-pointer
          transition-all duration-200
          ${isDragging 
            ? 'border-blue-500 bg-blue-50' 
            : 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'
          }
        `}
      >
        <Upload className={`w-16 h-16 mx-auto mb-4 ${
          isDragging ? 'text-blue-500' : 'text-slate-400'
        }`} />
        <p className="text-lg font-medium text-slate-700 mb-2">
          Drop your CSV file here or click to browse
        </p>
        <p className="text-sm text-slate-500">
          Accepts .csv files only
        </p>
        <input 
          ref={fileInputRef}
          type="file" 
          accept=".csv" 
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex gap-3">
          <FileText className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-blue-900 mb-1">
              Expected Columns:
            </p>
            <ul className="text-blue-700 space-y-1">
              <li>• User Story ID (copado__User_Story__r.Name)</li>
              <li>• Metadata Name (copado__Metadata_API_Name__c)</li>
              <li>• Last Commit Date (optional)</li>
              <li>• Developer Name (optional)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UploadStep;