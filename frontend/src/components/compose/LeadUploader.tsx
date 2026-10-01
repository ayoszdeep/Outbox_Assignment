import { useCallback, useState } from 'react';
import { UploadCloud, FileText, X, CheckCircle2, AlertTriangle } from 'lucide-react';
import { parseEmailsFromFile } from '../../utils/csvParser';

interface LeadUploaderProps {
  onFileSelect: (file: File | null) => void;
}

export const LeadUploader: React.FC<LeadUploaderProps> = ({ onFileSelect }) => {
  const [file, setFile] = useState<File | null>(null);
  const [stats, setStats] = useState<{ valid: number; invalid: number; duplicates: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState('');

  const processFile = async (selectedFile: File) => {
    setError('');
    const ext = selectedFile.name.split('.').pop()?.toLowerCase();
    if (ext !== 'csv' && ext !== 'txt') {
      setError('Only .csv and .txt files are supported.');
      return;
    }

    setFile(selectedFile);
    try {
      const result = await parseEmailsFromFile(selectedFile);
      setStats(result);
      if (result.valid > 0) {
        onFileSelect(selectedFile);
      } else {
        setError('No valid emails found in the file.');
        onFileSelect(null);
      }
    } catch (err) {
      setError('Failed to parse file.');
      onFileSelect(null);
    }
  };

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  }, []);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFile(e.target.files[0]);
    }
  };

  const clearFile = () => {
    setFile(null);
    setStats(null);
    setError('');
    onFileSelect(null);
  };

  if (file && stats) {
    return (
      <div className="w-full border border-gray-200  rounded-lg p-4 bg-[#FFFAF0] ">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-green-100  text-green-600  rounded-md">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900 ">{file.name}</p>
              <p className="text-xs text-gray-500 ">
                {(file.size / 1024).toFixed(1)} KB
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={clearFile}
            className="text-gray-400 hover:text-red-500 transition-colors p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="space-y-2 text-sm">
          <div className="flex items-center text-green-600 ">
            <CheckCircle2 className="w-4 h-4 mr-2" />
            <span>{stats.valid} valid email addresses detected</span>
          </div>
          {stats.invalid > 0 && (
            <div className="flex items-center text-amber-600 ">
              <AlertTriangle className="w-4 h-4 mr-2" />
              <span>{stats.invalid} invalid addresses ignored</span>
            </div>
          )}
          {stats.duplicates > 0 && (
            <div className="flex items-center text-amber-600 ">
              <AlertTriangle className="w-4 h-4 mr-2" />
              <span>{stats.duplicates} duplicates removed</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div 
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
        onDrop={onDrop}
        className={`w-full border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragging 
            ? 'border-green-500 bg-green-50 ' 
            : error 
              ? 'border-red-300 bg-red-50  '
              : 'border-gray-200  hover:border-gray-400 :border-gray-500 bg-[#FFFAF0] '
        }`}
      >
        <UploadCloud className={`w-10 h-10 mx-auto mb-4 ${isDragging ? 'text-green-500' : 'text-gray-400'}`} />
        <p className="text-sm text-gray-700  mb-1">
          <span className="font-semibold">Drop CSV/TXT here</span> or{' '}
          <label className="text-green-600  cursor-pointer hover:underline">
            Browse
            <input type="file" className="hidden" accept=".csv,.txt" onChange={onFileChange} />
          </label>
        </p>
        <p className="text-xs text-gray-500 ">Supports file containing comma or newline separated emails</p>
      </div>
      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
    </div>
  );
};
