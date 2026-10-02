import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { PenSquare } from 'lucide-react';
import { EmailList } from '../components/dashboard/EmailList';

export const Dashboard = () => {
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // /dashboard/sent shows sent (and failed) emails; /dashboard shows what is still queued.
  const currentTab = location.pathname.includes('/sent') ? 'sent' : 'scheduled';
  const searchQuery = searchParams.get('search') || '';

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 capitalize">
            {searchQuery ? 'Search Results' : `${currentTab} Emails`}
          </h2>
          <p className="text-sm text-gray-500">
            {searchQuery
              ? `Showing results for "${searchQuery}"`
              : `Manage and track your ${currentTab} campaigns.`}
          </p>
        </div>

        <Link
          to="/compose"
          className="inline-flex items-center h-10 px-4 rounded-md bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors shrink-0"
        >
          <PenSquare className="w-4 h-4 mr-2" />
          Compose New Email
        </Link>
      </div>

      <div className="flex items-center gap-2 border-b border-gray-200">
        <Link
          to="/dashboard"
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            currentTab === 'scheduled'
              ? 'border-green-600 text-green-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Scheduled
        </Link>
        <Link
          to="/dashboard/sent"
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            currentTab === 'sent'
              ? 'border-green-600 text-green-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Sent
        </Link>
      </div>

      <div className="bg-[#FFFAF0] border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        <EmailList status={currentTab} searchQuery={searchQuery} />
      </div>
    </div>
  );
};
