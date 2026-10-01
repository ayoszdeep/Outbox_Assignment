import { useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { Clock, Send } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { SenderSelect } from './SenderSelect';
import { LeadUploader } from './LeadUploader';
import { MessageEditor } from './MessageEditor';
import { SchedulePicker } from './SchedulePicker';
import { scheduleCampaign } from '../../services/emailApi';

export const ComposeForm = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [senderId, setSenderId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [directEmails, setDirectEmails] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [delayMs, setDelayMs] = useState('');
  const [hourlyLimit, setHourlyLimit] = useState('');
  
  // Scheduling State
  const [isSchedulingMode, setIsSchedulingMode] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');

  const validateForm = () => {
    if (!senderId) return 'Please select a sender.';
    if (!file && !directEmails.trim()) return 'Please upload a file or type recipient emails.';
    if (!subject.trim()) return 'Please enter a subject line.';
    if (!body.trim()) return 'Please write a message body.';
    if (isSchedulingMode && (!scheduleDate || !scheduleTime)) {
      return 'Please specify both date and time for scheduling.';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append('senderId', senderId);
      
      // If user typed emails, generate a CSV blob on the fly
      const allDirectEmails = [directEmails, emailInput].filter(Boolean).join(',');
      if (allDirectEmails.trim()) {
        const emailListCsv = 'Email\n' + allDirectEmails.split(',').map(e => e.trim()).filter(Boolean).join('\n');
        const fileBlob = new Blob([emailListCsv], { type: 'text/csv' });
        formData.append('file', fileBlob, 'recipients.csv');
      } else if (file) {
        formData.append('file', file as Blob);
      }
      
      formData.append('subject', subject);
      formData.append('body', body);
      formData.append('delayMs', delayMs);
      formData.append('hourlyLimit', hourlyLimit);
      
      if (isSchedulingMode && scheduleDate && scheduleTime) {
        const dateTimeStr = `${scheduleDate}T${scheduleTime}:00`;
        const startTime = new Date(dateTimeStr).toISOString();
        formData.append('startTime', startTime);
      } else {
        // Send now
        formData.append('startTime', new Date().toISOString());
      }

      await scheduleCampaign(formData);
      toast.success('Campaign scheduled successfully!');
      navigate('/dashboard?tab=scheduled');
    } catch (err: any) {
      setError(err.message || 'Failed to schedule campaign');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="h-full flex flex-col bg-[#FFFAF0]">
      {/* Header */}
      <div className="px-8 py-6 flex items-center justify-between border-b border-gray-200">
        <div className="flex items-center space-x-3 cursor-pointer hover:opacity-80" onClick={() => navigate('/dashboard')}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-800">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          <h2 className="text-xl font-medium text-gray-800">Compose New Email</h2>
        </div>
        
        <div className="relative flex items-center space-x-4">
          <div className="relative">
            <label className="text-green-500 hover:text-green-600 cursor-pointer flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
              <input
                type="file"
                className="hidden"
                accept=".csv,.txt"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setFile(f);
                    toast.success(`Attached ${f.name} as recipient list.`);
                  }
                }}
              />
            </label>
          </div>
          <button 
            type="button" 
            onClick={() => setIsSchedulingMode(!isSchedulingMode)}
            className="text-green-500 hover:text-green-600"
          >
            <Clock className="w-5 h-5" />
          </button>
          <button 
            type="submit" 
            className="px-4 py-1.5 border border-green-500 text-green-500 rounded-full text-sm font-medium hover:bg-green-50 transition-colors"
          >
            Send
          </button>
          
          {isSchedulingMode && (
            <div className="absolute top-12 right-0 w-72 bg-white rounded-lg shadow-[0_4px_20px_-2px_rgba(0,0,0,0.1)] border border-gray-100 z-50 p-4">
              <h3 className="text-gray-900 font-medium mb-4">Send Later</h3>
              <div className="relative mb-2 group">
                <input 
                  type="text"
                  placeholder="Pick date & time"
                  className="w-full text-sm text-gray-500 border-b border-gray-100 pb-2 bg-transparent outline-none group-hover:border-gray-200 transition-colors cursor-pointer"
                  value={scheduleDate ? `${scheduleDate}${scheduleTime ? ', ' + scheduleTime : ''}` : ''}
                  readOnly
                />
                <input
                  type="datetime-local"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val) {
                      const dateObj = new Date(val);
                      // Set internal state to standard YYYY-MM-DD and HH:MM format for the backend later
                      setScheduleDate(val.split('T')[0]);
                      setScheduleTime(val.split('T')[1]);
                    }
                  }}
                />
                <svg className="w-4 h-4 text-gray-400 absolute right-0 top-0 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
              </div>
              <div className="space-y-3 py-2 mb-4">
                <button type="button" onClick={() => { setScheduleDate('Tomorrow'); setScheduleTime(''); }} className="block w-full text-left text-sm text-gray-600 hover:text-gray-900">Tomorrow</button>
                <button type="button" onClick={() => { setScheduleDate('Tomorrow'); setScheduleTime('10:00 AM'); }} className="block w-full text-left text-sm text-gray-600 hover:text-gray-900">Tomorrow, 10:00 AM</button>
                <button type="button" onClick={() => { setScheduleDate('Tomorrow'); setScheduleTime('11:00 AM'); }} className="block w-full text-left text-sm text-gray-600 hover:text-gray-900">Tomorrow, 11:00 AM</button>
                <button type="button" onClick={() => { setScheduleDate('Tomorrow'); setScheduleTime('3:00 PM'); }} className="block w-full text-left text-sm text-gray-600 hover:text-gray-900">Tomorrow, 3:00 PM</button>
              </div>
              <div className="flex items-center justify-end space-x-3 pt-2">
                <button type="button" onClick={() => setIsSchedulingMode(false)} className="text-sm font-medium text-gray-900 hover:text-gray-600">Cancel</button>
                <button type="button" onClick={() => setIsSchedulingMode(false)} className="px-4 py-1.5 border border-green-500 text-green-500 rounded-full text-sm font-medium hover:bg-green-50 transition-colors">Done</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide px-8 py-6 space-y-6 max-w-5xl mx-auto w-full">
        {error && (
          <div className="p-3 text-[15px] text-red-500 bg-red-50 rounded-md">
            {error}
          </div>
        )}

        {/* From Row */}
        <div className="grid grid-cols-[150px_1fr] items-center border-b border-gray-200 pb-4">
          <label className="text-[15px] font-medium text-gray-700">From</label>
          <div className="w-full">
            <SenderSelect value={senderId} onChange={setSenderId} />
          </div>
        </div>

        {/* To Row */}
        <div className="grid grid-cols-[150px_1fr] items-center border-b border-gray-200 pb-4">
          <label className="text-[15px] font-medium text-gray-700">To</label>
          <div className="flex items-center justify-between w-full">
            <div className="flex-1 flex items-center space-x-2 mr-4">
              {file ? (
                <div className="flex space-x-2">
                  <span className="px-3 py-1 bg-green-50 text-green-700 border border-green-200 rounded-full text-xs font-medium">
                    {file.name}
                  </span>
                  <span className="px-2 py-1 border border-gray-200 text-gray-600 rounded-full text-xs font-medium">
                    + File attached
                  </span>
                  <button type="button" onClick={() => setFile(null)} className="text-red-500 text-xs hover:underline ml-2">Remove</button>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2 items-center flex-1">
                  {directEmails.split(',').map(e => e.trim()).filter(Boolean).map((email, idx) => (
                    <span key={idx} className="inline-flex items-center px-3 py-1 rounded-full text-[13.5px] font-medium text-gray-800 bg-[#E8F8EE] border border-green-500">
                      {email}
                      <button type="button" onClick={() => {
                        const newEmails = directEmails.split(',').map(e => e.trim()).filter(Boolean);
                        newEmails.splice(idx, 1);
                        setDirectEmails(newEmails.join(', '));
                      }} className="ml-1.5 text-green-700 hover:text-green-900">&times;</button>
                    </span>
                  ))}
                  <input 
                    type="text" 
                    value={emailInput}
                    onChange={(e) => {
                      if (e.target.value.endsWith(',') || e.target.value.endsWith(' ')) {
                        const val = e.target.value.slice(0, -1).trim();
                        if (val) setDirectEmails(directEmails ? `${directEmails}, ${val}` : val);
                        setEmailInput('');
                      } else {
                        setEmailInput(e.target.value);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && emailInput.trim()) {
                        e.preventDefault();
                        setDirectEmails(directEmails ? `${directEmails}, ${emailInput.trim()}` : emailInput.trim());
                        setEmailInput('');
                      } else if (e.key === 'Backspace' && !emailInput && directEmails) {
                        const newEmails = directEmails.split(',').map(e => e.trim()).filter(Boolean);
                        newEmails.pop();
                        setDirectEmails(newEmails.join(', '));
                      }
                    }}
                    placeholder={directEmails ? "" : "recipient@example.com"}
                    className="flex-1 min-w-[120px] text-[15px] text-gray-900 placeholder-gray-400 outline-none border-none bg-transparent focus:ring-0 p-0"
                  />
                </div>
              )}
            </div>
            
            <div className="relative shrink-0">
              <label className="flex items-center text-green-500 hover:text-green-600 text-[15px] font-medium cursor-pointer">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
                </svg>
                Upload List
                <input
                  type="file"
                  className="hidden"
                  accept=".csv,.txt"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setFile(f);
                  }}
                />
              </label>
            </div>
          </div>
        </div>

        {/* Subject Row */}
        <div className="grid grid-cols-[150px_1fr] items-center border-b border-gray-200 pb-4">
          <label className="text-[15px] font-medium text-gray-700">Subject</label>
          <input 
            type="text"
            placeholder="Subject" 
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full text-[15px] text-gray-900 placeholder-gray-400 outline-none border-none bg-transparent focus:ring-0 p-0"
          />
        </div>

        {/* Limits Row */}
        <div className="grid grid-cols-[150px_1fr] items-center border-b border-gray-200 pb-4">
          <label className="text-[15px] font-medium text-gray-700">Pacing</label>
          <div className="flex items-center space-x-8">
            <div className="flex items-center space-x-3">
              <label className="text-[15px] text-gray-600">Delay between 2 emails</label>
              <input 
                type="number" 
                value={delayMs}
                onChange={(e) => setDelayMs(e.target.value)}
                placeholder="00"
                className="w-16 h-8 border border-gray-200 rounded-md text-center text-[15px] focus:outline-none focus:border-green-500 placeholder-gray-400"
              />
            </div>
            <div className="flex items-center space-x-3">
              <label className="text-[15px] text-gray-600">Hourly Limit</label>
              <input 
                type="number" 
                value={hourlyLimit}
                onChange={(e) => setHourlyLimit(e.target.value)}
                placeholder="00"
                className="w-16 h-8 border border-gray-200 rounded-md text-center text-[15px] focus:outline-none focus:border-green-500 placeholder-gray-400"
              />
            </div>
          </div>
        </div>

        {/* Editor area */}
        <div className="pt-2">
          <MessageEditor 
            value={body} 
            onChange={setBody} 
            onAttach={(f) => {
              setFile(f);
              toast.success(`Attached ${f.name} as recipient list.`);
            }}
          />
        </div>
      </div>
    </form>
  );
};
