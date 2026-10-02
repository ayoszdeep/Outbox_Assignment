import { useNavigate } from 'react-router-dom';
import type { EmailSummary } from '../../types/email';
import { StatusBadge } from './StatusBadge';

interface EmailRowProps {
  email: EmailSummary;
}

const formatTimestamp = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString();
};

const toSnippet = (body?: string) => {
  if (!body) return 'No content...';
  const text = body.replace(/<[^>]*>?/gm, '').trim();
  return text.length > 60 ? `${text.slice(0, 60)}...` : text || 'No content...';
};

export const EmailRow: React.FC<EmailRowProps> = ({ email }) => {
  const navigate = useNavigate();

  // Sent and failed emails are judged on when they went out; anything else on when it is due.
  const isDelivered = email.status === 'sent' || email.status === 'failed';
  const timestamp = isDelivered ? email.sentAt || email.scheduledAt : email.scheduledAt;

  return (
    <div
      onClick={() => navigate(`/email/${email.id}`)}
      className="flex items-center gap-4 px-8 py-5 border-b border-gray-100 hover:bg-[#F9F6F0] cursor-pointer transition-colors bg-white"
    >
      <div className="w-56 shrink-0">
        <p className="text-[15px] font-semibold text-gray-800 truncate">
          To: {email.recipient}
        </p>
      </div>

      <div className="flex-1 flex items-center gap-3 min-w-0">
        <StatusBadge status={email.status} />
        <div className="truncate text-[15px]">
          <span className="font-semibold text-gray-800">{email.subject}</span>
          <span className="text-gray-400 font-normal"> - {toSnippet(email.body)}</span>
        </div>
      </div>

      <div className="w-48 shrink-0 text-right">
        <p className="text-xs text-gray-400 uppercase tracking-wide">
          {isDelivered ? 'Sent' : 'Scheduled'}
        </p>
        <p className="text-sm text-gray-600 whitespace-nowrap">{formatTimestamp(timestamp)}</p>
      </div>
    </div>
  );
};
