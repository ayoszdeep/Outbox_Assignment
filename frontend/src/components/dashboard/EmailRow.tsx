
import { useNavigate } from 'react-router-dom';

interface Email {
  id: string;
  recipient: string;
  subject: string;
  body?: string;
  scheduledAt?: string;
  sentAt?: string;
  status: 'scheduled' | 'sent' | 'failed';
}

interface EmailRowProps {
  email: Email;
}

export const EmailRow: React.FC<EmailRowProps> = ({ email }) => {
  const navigate = useNavigate();
  
  const handleRowClick = () => {
    navigate(`/email/${email.id}`);
  };

  const snippet = email.body 
    ? email.body.replace(/<[^>]*>?/gm, '').substring(0, 60) + (email.body.length > 60 ? '...' : '') 
    : 'No content...';

  return (
    <div 
      onClick={handleRowClick}
      className="flex items-center px-8 py-5 border-b border-gray-100 hover:bg-[#F9F6F0] cursor-pointer transition-colors group bg-white"
    >
      <div className="w-64 shrink-0 pr-4">
        <p className="text-[15px] font-semibold text-gray-800 truncate">
          To: {email.recipient}
        </p>
      </div>
      
      <div className="flex-1 flex items-center space-x-3 min-w-0">
        <span className="inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 shrink-0">
          {email.status === 'scheduled' ? 'Scheduled' : email.status === 'failed' ? 'Failed' : 'Sent'}
        </span>
        <div className="truncate text-[15px]">
          <span className="font-semibold text-gray-800">{email.subject}</span>
          <span className="text-gray-400 font-normal"> - {snippet}</span>
        </div>
      </div>
    </div>
  );
};
