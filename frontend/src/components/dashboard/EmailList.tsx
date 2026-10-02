import { useEffect, useState } from 'react';
import { Clock, Inbox, SearchX } from 'lucide-react';
import { getEmailsByStatus, searchEmails } from '../../services/emailApi';
import type { EmailSummary } from '../../types/email';
import { EmailRow } from './EmailRow';

interface EmailListProps {
  status: 'scheduled' | 'sent';
  searchQuery?: string;
}

const byMostRecent = (a: EmailSummary, b: EmailSummary) => b.id - a.id;

/**
 * Loads one view of the mailbox.
 *
 * The "Sent" tab deliberately includes failed emails: a delivery attempt that bounced is
 * still an attempt the user needs to see, and the status column tells the two apart.
 */
const loadEmails = async (status: EmailListProps['status'], searchQuery?: string): Promise<EmailSummary[]> => {
  if (searchQuery) {
    const response = await searchEmails(searchQuery);
    return (response.data || []).slice().sort(byMostRecent);
  }

  if (status === 'scheduled') {
    const response = await getEmailsByStatus('scheduled');
    return response.data || [];
  }

  const [sent, failed] = await Promise.all([
    getEmailsByStatus('sent'),
    getEmailsByStatus('failed'),
  ]);

  return [...(sent.data || []), ...(failed.data || [])].sort(byMostRecent);
};

export const EmailList: React.FC<EmailListProps> = ({ status, searchQuery }) => {
  const [emails, setEmails] = useState<EmailSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let isCurrent = true;

    const fetchEmails = async () => {
      setIsLoading(true);
      setError('');

      try {
        const result = await loadEmails(status, searchQuery);
        if (isCurrent) setEmails(result);
      } catch (err) {
        if (isCurrent) setError(err instanceof Error ? err.message : 'Failed to load emails');
      } finally {
        if (isCurrent) setIsLoading(false);
      }
    };

    void fetchEmails();

    // Guards against a slow earlier request overwriting the newer one's results.
    return () => {
      isCurrent = false;
    };
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
      <div className="p-12 text-center text-red-500 bg-red-50">
        {error}
      </div>
    );
  }

  if (emails.length === 0) {
    const EmptyIcon = searchQuery ? SearchX : status === 'scheduled' ? Clock : Inbox;

    return (
      <div className="p-24 text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-100 text-gray-400 mb-4">
          <EmptyIcon className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-1">
          {searchQuery ? 'No matching emails' : `No ${status} emails`}
        </h3>
        <p className="text-gray-500 text-sm">
          {searchQuery
            ? 'Try a different recipient, subject or phrase from the body.'
            : status === 'scheduled'
              ? 'Schedule an email and it will appear here.'
              : 'Your sent emails will appear here.'}
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
