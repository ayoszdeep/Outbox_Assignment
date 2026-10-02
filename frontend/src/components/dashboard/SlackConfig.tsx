import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Button } from '../ui/Button';
import { disconnectSlack, getSlackConnectUrl, getSlackStatus } from '../../services/slackApi';
import type { SlackStatus } from '../../types/email';

export const SlackConfig = () => {
  const [status, setStatus] = useState<SlackStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();

  const loadStatus = useCallback(async () => {
    try {
      const response = await getSlackStatus();
      setStatus(response.data);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to read Slack status');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  // The OAuth callback sends the user back here with the outcome on the query string.
  useEffect(() => {
    const outcome = searchParams.get('slack');
    if (!outcome) return;

    if (outcome === 'connected') {
      const channel = searchParams.get('channel');
      toast.success(channel ? `Slack connected to ${channel}` : 'Slack connected');
    } else {
      toast.error(searchParams.get('message') || 'Could not connect Slack');
    }

    searchParams.delete('slack');
    searchParams.delete('channel');
    searchParams.delete('message');
    setSearchParams(searchParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const handleConnect = async () => {
    setIsBusy(true);
    try {
      window.location.href = await getSlackConnectUrl();
    } catch (err) {
      setIsBusy(false);
      toast.error(err instanceof Error ? err.message : 'Slack is not configured on the server');
    }
  };

  const handleDisconnect = async () => {
    setIsBusy(true);
    try {
      await disconnectSlack();
      await loadStatus();
      toast.success('Slack disconnected');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to disconnect Slack');
    } finally {
      setIsBusy(false);
    }
  };

  if (isLoading) {
    return <div className="text-sm text-gray-500">Checking Slack integration...</div>;
  }

  const isConnected = Boolean(status?.connected);
  const needsReconnect = status?.status === 'invalid';

  return (
    <div className="bg-[#FFFAF0] border border-gray-200 rounded-lg p-6">
      <div className="flex items-start justify-between gap-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            Slack Integration
            {isConnected && (
              <span className="ml-3 inline-flex items-center space-x-1 text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                <span>Connected</span>
              </span>
            )}
            {needsReconnect && (
              <span className="ml-3 inline-flex items-center text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                Reconnect needed
              </span>
            )}
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Get a Slack message the moment a sender hits its hourly limit. Emails are never
            dropped - they are rescheduled into the next hour window.
          </p>
          {status?.lastError && (
            <p className="mt-2 text-xs text-amber-700">
              Last Slack error: {status.lastError}
            </p>
          )}
          {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
        </div>

        <div className="shrink-0">
          {isConnected ? (
            <Button
              variant="outline"
              onClick={handleDisconnect}
              isLoading={isBusy}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              Disconnect Workspace
            </Button>
          ) : (
            <Button
              onClick={handleConnect}
              isLoading={isBusy}
              className="bg-[#4A154B] hover:bg-[#361036] text-white border-none"
            >
              <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521h-6.313A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.313zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
              </svg>
              Connect Slack
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
