import { API_BASE_URL, fetchApi } from './api';
import type {
  ApiResponse,
  EmailDetail,
  EmailSummary,
  PaginatedResponse,
  ScheduleCampaignResult,
  Sender,
} from '../types/email';

export const getEmailsByStatus = (status: 'scheduled' | 'sent' | 'failed', page = 1, limit = 20) =>
  fetchApi(`/emails?status=${status}&page=${page}&limit=${limit}`) as Promise<PaginatedResponse<EmailSummary>>;

export const getScheduledEmails = (page = 1, limit = 20) => getEmailsByStatus('scheduled', page, limit);
export const getSentEmails = (page = 1, limit = 20) => getEmailsByStatus('sent', page, limit);
export const getFailedEmails = (page = 1, limit = 20) => getEmailsByStatus('failed', page, limit);

/** Full-text search, served by the Elasticsearch index rather than the database. */
export const searchEmails = (query: string) =>
  fetchApi(`/emails/search?q=${encodeURIComponent(query)}`) as Promise<ApiResponse<EmailSummary[]>>;

export const getEmail = (id: string | number) =>
  fetchApi(`/emails/${id}`) as Promise<ApiResponse<EmailDetail>>;

export const getSenders = () => fetchApi('/senders') as Promise<ApiResponse<Sender[]>>;

export const createSender = (name: string) =>
  fetchApi('/senders', {
    method: 'POST',
    body: JSON.stringify({ name }),
  }) as Promise<ApiResponse<Sender>>;

/**
 * Campaigns are posted as multipart/form-data because they carry the lead file, so this one
 * call goes through plain fetch: setting Content-Type by hand would drop the multipart
 * boundary the browser generates.
 */
export const scheduleCampaign = async (formData: FormData): Promise<ApiResponse<ScheduleCampaignResult>> => {
  const token = localStorage.getItem('token');

  const response = await fetch(`${API_BASE_URL}/campaigns/schedule`, {
    method: 'POST',
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: formData,
  });

  const json = await response.json().catch(() => ({}));

  if (!response.ok || !json?.success) {
    throw new Error(json?.message || 'Failed to schedule campaign');
  }

  return json as ApiResponse<ScheduleCampaignResult>;
};
