import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { Clock, Paperclip, Upload, X } from 'lucide-react';
import { SenderSelect } from './SenderSelect';
import { MessageEditor } from './MessageEditor';
import { scheduleCampaign } from '../../services/emailApi';
import { parseLeadText } from '../../utils/csvParser';

/** Defaults mirror the backend's MIN_DELAY_MS / MAX_EMAILS_PER_HOUR defaults. */
const DEFAULT_DELAY_SECONDS = '2';
const DEFAULT_HOURLY_LIMIT = '100';

/** `YYYY-MM-DDTHH:mm` in local time, which is what a datetime-local input expects. */
const toLocalInputValue = (date: Date) => {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const tomorrowAt = (hour: number) => {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(hour, 0, 0, 0);
  return toLocalInputValue(date);
};

export const ComposeForm = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const [senderId, setSenderId] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileText, setFileText] = useState('');
  const [directEmails, setDirectEmails] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [delaySeconds, setDelaySeconds] = useState(DEFAULT_DELAY_SECONDS);
  const [hourlyLimit, setHourlyLimit] = useState(DEFAULT_HOURLY_LIMIT);

  const [isSchedulingMode, setIsSchedulingMode] = useState(false);
  const [startAt, setStartAt] = useState('');

  // "Now" for the picker's min attribute, fixed once so it cannot shift between renders.
  const [earliestStartAt] = useState(() => toLocalInputValue(new Date()));

  const typedEmails = useMemo(
    () => directEmails.split(',').map((value) => value.trim()).filter(Boolean),
    [directEmails],
  );

  /**
   * Typed recipients and an uploaded list are merged into one lead list, so the count shown
   * here is exactly what gets posted - and it is counted with the same parser the backend
   * uses, so the two can never disagree.
   */
  const leadText = useMemo(
    () => [typedEmails.join('\n'), fileText].filter(Boolean).join('\n'),
    [typedEmails, fileText],
  );
  const leadStats = useMemo(() => parseLeadText(leadText), [leadText]);

  const addTypedEmail = (value: string) => {
    const email = value.trim().replace(/,$/, '');
    if (!email) return;
    setDirectEmails(directEmails ? `${directEmails}, ${email}` : email);
    setEmailInput('');
  };

  const removeTypedEmail = (index: number) => {
    const next = [...typedEmails];
    next.splice(index, 1);
    setDirectEmails(next.join(', '));
  };

  const handleFile = async (file: File) => {
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (extension !== 'csv' && extension !== 'txt') {
      toast.error('Only .csv and .txt lead files are supported');
      return;
    }

    try {
      const text = await file.text();
      const stats = parseLeadText(text);

      if (stats.valid === 0) {
        toast.error('No email addresses found in that file');
        return;
      }

      setFileName(file.name);
      setFileText(text);
      toast.success(`${file.name}: ${stats.valid} email address${stats.valid === 1 ? '' : 'es'} detected`);
    } catch {
      toast.error('Could not read that file');
    }
  };

  const clearFile = () => {
    setFileName('');
    setFileText('');
  };

  const validateForm = () => {
    if (!senderId) return 'Please select a sender.';
    if (leadStats.valid === 0) return 'Please upload a lead file or type at least one recipient email.';
    if (!subject.trim()) return 'Please enter a subject line.';
    if (!body.trim() || !body.replace(/<[^>]*>?/gm, '').trim()) return 'Please write a message body.';
    if (!(Number(delaySeconds) > 0)) return 'Delay between emails must be greater than 0 seconds.';
    if (!(Number(hourlyLimit) > 0)) return 'Hourly limit must be greater than 0.';
    if (isSchedulingMode && !startAt) return 'Please pick the date and time to start sending.';
    if (isSchedulingMode && Number.isNaN(new Date(startAt).getTime())) return 'That start time is not a valid date.';
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
      formData.append('subject', subject);
      formData.append('body', body);
      // The API takes the gap in milliseconds; the form asks for seconds.
      formData.append('delayMs', String(Math.round(Number(delaySeconds) * 1000)));
      formData.append('hourlyLimit', String(Number(hourlyLimit)));
      formData.append(
        'startTime',
        (isSchedulingMode && startAt ? new Date(startAt) : new Date()).toISOString(),
      );
      formData.append('file', new Blob([leadText], { type: 'text/csv' }), fileName || 'recipients.csv');

      const response = await scheduleCampaign(formData);
      toast.success(`Scheduled ${response.data.emailCount} email${response.data.emailCount === 1 ? '' : 's'}`);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to schedule campaign');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="h-full flex flex-col bg-[#FFFAF0]">
      <div className="px-8 py-6 flex items-center justify-between border-b border-gray-200">
        <div className="flex items-center space-x-3 cursor-pointer hover:opacity-80" onClick={() => navigate('/dashboard')}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-800">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          <h2 className="text-xl font-medium text-gray-800">Compose New Email</h2>
        </div>

        <div className="relative flex items-center space-x-4">
          <label className="text-green-500 hover:text-green-600 cursor-pointer flex items-center" title="Attach a lead list">
            <Paperclip className="w-5 h-5" />
            <input
              type="file"
              className="hidden"
              accept=".csv,.txt"
              onChange={(e) => {
                const selected = e.target.files?.[0];
                if (selected) void handleFile(selected);
                e.target.value = '';
              }}
            />
          </label>

          <button
            type="button"
            onClick={() => setIsSchedulingMode(!isSchedulingMode)}
            className={`transition-colors ${isSchedulingMode ? 'text-green-700' : 'text-green-500 hover:text-green-600'}`}
            title="Schedule for later"
          >
            <Clock className="w-5 h-5" />
          </button>

          <button
            type="submit"
            disabled={isLoading}
            className="px-4 py-1.5 border border-green-500 text-green-500 rounded-full text-sm font-medium hover:bg-green-50 transition-colors disabled:opacity-50 disabled:pointer-events-none"
          >
            {isLoading ? 'Scheduling...' : isSchedulingMode ? 'Schedule' : 'Send'}
          </button>

          {isSchedulingMode && (
            <div className="absolute top-12 right-0 w-72 bg-white rounded-lg shadow-[0_4px_20px_-2px_rgba(0,0,0,0.1)] border border-gray-100 z-50 p-4">
              <h3 className="text-gray-900 font-medium mb-3">Send later</h3>
              <input
                type="datetime-local"
                value={startAt}
                min={earliestStartAt}
                onChange={(e) => setStartAt(e.target.value)}
                className="w-full text-sm text-gray-700 border border-gray-200 rounded-md px-2 py-1.5 mb-3 outline-none focus:border-green-500"
              />
              <div className="space-y-2 mb-4">
                {[
                  { label: 'Tomorrow, 10:00 AM', hour: 10 },
                  { label: 'Tomorrow, 11:00 AM', hour: 11 },
                  { label: 'Tomorrow, 3:00 PM', hour: 15 },
                ].map((option) => (
                  <button
                    key={option.label}
                    type="button"
                    onClick={() => setStartAt(tomorrowAt(option.hour))}
                    className="block w-full text-left text-sm text-gray-600 hover:text-gray-900"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-end space-x-3 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => { setIsSchedulingMode(false); setStartAt(''); }}
                  className="text-sm font-medium text-gray-900 hover:text-gray-600"
                >
                  Send now instead
                </button>
                <button
                  type="button"
                  onClick={() => setIsSchedulingMode(false)}
                  className="px-4 py-1.5 border border-green-500 text-green-500 rounded-full text-sm font-medium hover:bg-green-50 transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-6 max-w-5xl mx-auto w-full">
        {error && (
          <div className="p-3 text-[15px] text-red-500 bg-red-50 rounded-md">
            {error}
          </div>
        )}

        {/* From */}
        <div className="grid grid-cols-[150px_1fr] items-center border-b border-gray-200 pb-4">
          <label className="text-[15px] font-medium text-gray-700">From</label>
          <SenderSelect value={senderId} onChange={setSenderId} />
        </div>

        {/* To */}
        <div className="grid grid-cols-[150px_1fr] items-start border-b border-gray-200 pb-4">
          <label className="text-[15px] font-medium text-gray-700 pt-1">To</label>
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-wrap gap-2 items-center flex-1">
                {typedEmails.map((email, index) => (
                  <span
                    key={`${email}-${index}`}
                    className="inline-flex items-center px-3 py-1 rounded-full text-[13.5px] font-medium text-gray-800 bg-[#E8F8EE] border border-green-500"
                  >
                    {email}
                    <button
                      type="button"
                      onClick={() => removeTypedEmail(index)}
                      className="ml-1.5 text-green-700 hover:text-green-900"
                      aria-label={`Remove ${email}`}
                    >
                      &times;
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  value={emailInput}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value.endsWith(',') || value.endsWith(' ')) {
                      addTypedEmail(value);
                    } else {
                      setEmailInput(value);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && emailInput.trim()) {
                      e.preventDefault();
                      addTypedEmail(emailInput);
                    } else if (e.key === 'Backspace' && !emailInput && typedEmails.length) {
                      removeTypedEmail(typedEmails.length - 1);
                    }
                  }}
                  onBlur={() => emailInput.trim() && addTypedEmail(emailInput)}
                  placeholder={typedEmails.length ? '' : 'recipient@example.com'}
                  className="flex-1 min-w-[160px] text-[15px] text-gray-900 placeholder-gray-400 outline-none border-none bg-transparent p-0"
                />
              </div>

              <label className="flex items-center text-green-500 hover:text-green-600 text-[15px] font-medium cursor-pointer shrink-0">
                <Upload className="w-4 h-4 mr-1.5" />
                Upload List
                <input
                  type="file"
                  className="hidden"
                  accept=".csv,.txt"
                  onChange={(e) => {
                    const selected = e.target.files?.[0];
                    if (selected) void handleFile(selected);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>

            {fileName && (
              <div className="flex items-center gap-2">
                <span className="px-3 py-1 bg-green-50 text-green-700 border border-green-200 rounded-full text-xs font-medium">
                  {fileName}
                </span>
                <button
                  type="button"
                  onClick={clearFile}
                  className="text-gray-400 hover:text-red-500"
                  aria-label="Remove lead file"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Required: show how many addresses were detected in the list. */}
            {(fileName || typedEmails.length > 0) && (
              <p className="text-xs text-gray-500">
                <span className="font-semibold text-green-700">{leadStats.valid}</span> email
                address{leadStats.valid === 1 ? '' : 'es'} detected
                {leadStats.duplicates > 0 && ` · ${leadStats.duplicates} duplicate${leadStats.duplicates === 1 ? '' : 's'} removed`}
                {leadStats.invalid > 0 && ` · ${leadStats.invalid} row${leadStats.invalid === 1 ? '' : 's'} ignored`}
              </p>
            )}
          </div>
        </div>

        {/* Subject */}
        <div className="grid grid-cols-[150px_1fr] items-center border-b border-gray-200 pb-4">
          <label className="text-[15px] font-medium text-gray-700" htmlFor="compose-subject">Subject</label>
          <input
            id="compose-subject"
            type="text"
            placeholder="Subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full text-[15px] text-gray-900 placeholder-gray-400 outline-none border-none bg-transparent p-0"
          />
        </div>

        {/* Pacing */}
        <div className="grid grid-cols-[150px_1fr] items-center border-b border-gray-200 pb-4">
          <label className="text-[15px] font-medium text-gray-700">Pacing</label>
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
            <div className="flex items-center space-x-3">
              <label className="text-[15px] text-gray-600" htmlFor="compose-delay">Delay between emails (seconds)</label>
              <input
                id="compose-delay"
                type="number"
                min={1}
                step={1}
                value={delaySeconds}
                onChange={(e) => setDelaySeconds(e.target.value)}
                className="w-20 h-8 border border-gray-200 rounded-md text-center text-[15px] focus:outline-none focus:border-green-500"
              />
            </div>
            <div className="flex items-center space-x-3">
              <label className="text-[15px] text-gray-600" htmlFor="compose-hourly">Hourly limit</label>
              <input
                id="compose-hourly"
                type="number"
                min={1}
                step={1}
                value={hourlyLimit}
                onChange={(e) => setHourlyLimit(e.target.value)}
                className="w-20 h-8 border border-gray-200 rounded-md text-center text-[15px] focus:outline-none focus:border-green-500"
              />
            </div>
          </div>
        </div>

        {/* Start time summary */}
        <div className="grid grid-cols-[150px_1fr] items-center border-b border-gray-200 pb-4">
          <label className="text-[15px] font-medium text-gray-700">Starts</label>
          <p className="text-[15px] text-gray-600">
            {isSchedulingMode && startAt
              ? new Date(startAt).toLocaleString()
              : 'Immediately after scheduling'}
          </p>
        </div>

        <div className="pt-2">
          <MessageEditor
            value={body}
            onChange={setBody}
            onAttach={(attached) => void handleFile(attached)}
          />
        </div>
      </div>
    </form>
  );
};
