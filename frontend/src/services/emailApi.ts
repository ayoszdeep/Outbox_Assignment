import { fetchApi } from './api';

export const getScheduledEmails = (page = 1, limit = 20) => {
  return fetchApi(`/emails?status=scheduled&page=${page}&limit=${limit}`);
};

export const getSentEmails = (page = 1, limit = 20) => {
  return fetchApi(`/emails?status=sent&page=${page}&limit=${limit}`);
};

export const getFailedEmails = (page = 1, limit = 20) => {
  return fetchApi(`/emails?status=failed&page=${page}&limit=${limit}`);
};

export const searchEmails = (query: string) => {
  return fetchApi(`/emails/search?q=${encodeURIComponent(query)}`);
};

export const getEmail = (id: string) => {
  return fetchApi(`/emails/${id}`);
};

export const scheduleCampaign = (formData: FormData) => {
  const token = localStorage.getItem('token');
  // We use standard fetch here because we need to omit Content-Type 
  // so the browser can automatically set the boundary for multipart/form-data
  return fetch(`/api/v1/campaigns/schedule`, {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  }).then(async (res) => {
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || err.error || 'Failed to schedule campaign');
    }
    return res.json();
  });
};
