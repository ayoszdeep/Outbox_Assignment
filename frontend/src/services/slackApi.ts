import type { ApiResponse, SlackStatus } from '../types/email';

const slackFetch = async <T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> => {
  const token = localStorage.getItem('token');

  const response = await fetch(`/api/slack${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const json = await response.json().catch(() => ({}));

  if (!response.ok || !json?.success) {
    throw new Error(json?.message || 'Slack request failed');
  }

  return json as ApiResponse<T>;
};

export const getSlackStatus = () => slackFetch<SlackStatus>('/status');

/**
 * Asks the backend for the Slack authorize URL instead of navigating to `/api/slack/connect`
 * directly: a top-level navigation carries no Authorization header, so the server could not
 * tell which user the OAuth state belongs to.
 */
export const getSlackConnectUrl = async () => {
  const response = await slackFetch<{ url: string }>('/connect-url');
  return response.data.url;
};

export const disconnectSlack = () => slackFetch<unknown>('/disconnect', { method: 'POST' });
