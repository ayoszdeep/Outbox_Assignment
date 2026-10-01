
import { useLocation, Navigate } from 'react-router-dom';
import { SlackConfig } from '../components/dashboard/SlackConfig';

export const Settings = () => {
  const location = useLocation();

  if (location.pathname === '/settings') {
    return <Navigate to="/settings/slack" replace />;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 ">
          Settings
        </h2>
        <p className="text-sm text-gray-500 ">
          Manage your account integrations and preferences.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="md:col-span-1 space-y-1">
          <div className="px-3 py-2 text-sm font-medium text-green-700 bg-green-50   rounded-md">
            Integrations
          </div>
          {/* Future setting tabs could go here */}
        </div>
        <div className="md:col-span-3">
          {location.pathname === '/settings/slack' && <SlackConfig />}
        </div>
      </div>
    </div>
  );
};
