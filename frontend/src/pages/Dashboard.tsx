
import { useLocation, useSearchParams } from 'react-router-dom';
import { EmailList } from '../components/dashboard/EmailList';

export const Dashboard = () => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  
  // If path is /dashboard/sent, use 'sent', else default to 'scheduled'
  const isSent = location.pathname.includes('/sent');
  const currentTab = isSent ? 'sent' : 'scheduled';
  const searchQuery = searchParams.get('search') || '';

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900  capitalize">
          {searchQuery ? 'Search Results' : `${currentTab} Emails`}
        </h2>
        <p className="text-sm text-gray-500 ">
          {searchQuery ? `Showing results for "${searchQuery}"` : `Manage and track your ${currentTab} campaigns.`}
        </p>
      </div>

      <div className="bg-[#FFFAF0]  border border-gray-200  rounded-lg shadow-sm overflow-hidden">
        <EmailList status={currentTab} />
      </div>
    </div>
  );
};
