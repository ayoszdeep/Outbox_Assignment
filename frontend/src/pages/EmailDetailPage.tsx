import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Star, Trash2 } from 'lucide-react';
import { getScheduledEmails, getSentEmails, getFailedEmails } from '../services/emailApi';
import { Button } from '../components/ui/Button';

export const EmailDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [email, setEmail] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchEmailDetails = async () => {
      try {
        // Backend doesn't have /emails/:id, so we fetch lists and find it.
        const [scheduled, sent, failed] = await Promise.all([
          getScheduledEmails(1, 100),
          getSentEmails(1, 100),
          getFailedEmails(1, 100)
        ]);
        
        const allEmails = [
          ...(scheduled.data || []),
          ...(sent.data || []),
          ...(failed.data || [])
        ];
        
        const found = allEmails.find((e: any) => String(e.id) === String(id));
        if (found) {
          setEmail(found);
        } else {
          setError('Email not found in recent lists');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load email details');
      } finally {
        setIsLoading(false);
      }
    };
    if (id) fetchEmailDetails();
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
      <div className="max-w-4xl mx-auto p-12 text-center text-red-500 bg-red-50  rounded-lg">
        {error || 'Email not found'}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto bg-[#FFFAF0]  border border-gray-200  rounded-lg shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-200  flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="px-2">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h2 className="text-xl font-semibold text-gray-900  truncate max-w-lg">
            {email.subject}
          </h2>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="sm" className="px-2 text-gray-400 hover:text-yellow-500">
            <Star className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" className="px-2 text-gray-400 hover:text-red-500">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Meta Info */}
      <div className="p-6 border-b border-gray-200  flex justify-between items-start">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-full bg-green-100  flex items-center justify-center text-green-600  font-bold">
            {email.sender?.email?.charAt(0).toUpperCase() || 'S'}
          </div>
          <div>
            <p className="font-medium text-gray-900 ">
              {email.sender?.email || 'Unknown Sender'}
            </p>
            <p className="text-sm text-gray-500 ">
              to {email.recipient}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500 ">
            {new Date(email.scheduledAt || email.createdAt).toLocaleString()}
          </p>
          {email.status === 'scheduled' && (
             <span className="inline-block mt-1 text-xs font-medium text-amber-600  bg-amber-50  px-2 py-0.5 rounded">
               Scheduled
             </span>
          )}
          {email.status === 'sent' && (
             <span className="inline-block mt-1 text-xs font-medium text-green-600  bg-green-50  px-2 py-0.5 rounded">
               Sent
             </span>
          )}
          {email.status === 'failed' && (
             <span className="inline-block mt-1 text-xs font-medium text-red-600  bg-red-50  px-2 py-0.5 rounded">
               Failed
             </span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="p-6 min-h-[300px]">
        <div 
          className="prose  max-w-none text-gray-800  whitespace-pre-wrap"
          dangerouslySetInnerHTML={{ __html: email.body }}
        />
      </div>
      
      {/* Error reason if failed */}
      {email.status === 'failed' && email.error && (
        <div className="p-4 m-6 mt-0 bg-red-50  border border-red-200  rounded-lg">
          <p className="text-sm font-medium text-red-800 ">Delivery Error</p>
          <p className="text-sm text-red-600  mt-1">{email.error}</p>
        </div>
      )}
    </div>
  );
};
