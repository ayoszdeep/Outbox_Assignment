import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { getEmail } from '../services/emailApi';
import type { EmailDetail } from '../types/email';
import { Button } from '../components/ui/Button';
import { StatusBadge } from '../components/dashboard/StatusBadge';

const formatTimestamp = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleString();
};

export const EmailDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [email, setEmail] = useState<EmailDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;

    const fetchEmail = async () => {
      setIsLoading(true);
      try {
        const response = await getEmail(id);
        setEmail(response.data);
        setError('');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load email details');
      } finally {
        setIsLoading(false);
      }
    };

    void fetchEmail();
  }, [id]);

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-12 text-center text-gray-500">
        <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        Loading email...
      </div>
    );
  }

  if (error || !email) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="px-2">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        <div className="p-12 text-center text-red-500 bg-red-50 rounded-lg">
          {error || 'Email not found'}
        </div>
      </div>
    );
  }

  const senderLabel = email.sender?.email || 'Unknown sender';
  const sentAt = formatTimestamp(email.sentAt);
  const scheduledAt = formatTimestamp(email.scheduledAt);

  return (
    <div className="max-w-4xl mx-auto bg-[#FFFAF0] border border-gray-200 rounded-lg shadow-sm overflow-hidden">
      <div className="p-4 border-b border-gray-200 flex items-center space-x-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="px-2">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h2 className="text-xl font-semibold text-gray-900 truncate">
          {email.subject}
        </h2>
      </div>

      <div className="p-6 border-b border-gray-200 flex justify-between items-start gap-6">
        <div className="flex items-center space-x-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-bold shrink-0">
            {senderLabel.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="font-medium text-gray-900 truncate">
              {email.sender?.name ? `${email.sender.name} <${senderLabel}>` : senderLabel}
            </p>
            <p className="text-sm text-gray-500 truncate">to {email.recipient}</p>
          </div>
        </div>

        <div className="text-right shrink-0 space-y-1">
          <StatusBadge status={email.status} />
          {sentAt && <p className="text-sm text-gray-500">Sent {sentAt}</p>}
          {!sentAt && scheduledAt && <p className="text-sm text-gray-500">Scheduled for {scheduledAt}</p>}
          {typeof email.attempts === 'number' && email.attempts > 0 && (
            <p className="text-xs text-gray-400">
              {email.attempts} delivery attempt{email.attempts === 1 ? '' : 's'}
            </p>
          )}
        </div>
      </div>

      <div className="p-6 min-h-[300px]">
        {/* The body is HTML the signed-in user composed themselves in the editor. */}
        <div
          className="prose max-w-none text-gray-800 whitespace-pre-wrap"
          dangerouslySetInnerHTML={{ __html: email.body || '' }}
        />
      </div>

      {email.errorMessage && (
        <div className="p-4 m-6 mt-0 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm font-medium text-red-800">Delivery error</p>
          <p className="text-sm text-red-600 mt-1">{email.errorMessage}</p>
        </div>
      )}
    </div>
  );
};
