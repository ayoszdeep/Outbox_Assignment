import { useEffect, useState } from 'react';
import { getScheduledEmails, getSentEmails, searchEmails } from '../../services/emailApi';
import { EmailRow } from './EmailRow';

interface EmailListProps {
  status: string;
  searchQuery?: string;
}

export const EmailList: React.FC<EmailListProps> = ({ status, searchQuery }) => {
  const [emails, setEmails] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchEmails = async () => {
      setIsLoading(true);
      setError('');
      try {
        let data;
        if (searchQuery) {
          data = await searchEmails(searchQuery);
        } else if (status === 'scheduled') {
          data = await getScheduledEmails();
        } else {
          data = await getSentEmails(); // Could also load failed based on status flag
        }
        setEmails(data.data || []);
      } catch (err: any) {
        setError(err.message || 'Failed to load emails');
      } finally {
        setIsLoading(false);
      }
    };

    fetchEmails();
  }, [status, searchQuery]);

  if (isLoading) {
    return (
      <div className="p-12 text-center text-gray-500">
        <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        Loading emails...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-12 text-center text-red-500 bg-red-50 ">
        {error}
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="p-24 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100  text-gray-400 mb-4">
          {status === 'scheduled' ? '◷' : '✈'}
        </div>
        <h3 className="text-lg font-medium text-gray-900  mb-1">
          No {status} emails
        </h3>
        <p className="text-gray-500  text-sm">
          {status === 'scheduled' ? 'Schedule an email and it will appear here.' : 'Your sent emails will appear here.'}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {emails.map((email) => (
        <EmailRow key={email.id} email={email} />
      ))}
    </div>
  );
};
