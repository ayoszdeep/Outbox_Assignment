export type EmailStatus = 'scheduled' | 'processing' | 'sent' | 'failed';

/** Shape returned by `GET /api/v1/emails` and by an Elasticsearch search hit. */
export interface EmailSummary {
  id: number;
  recipient: string;
  subject: string;
  body?: string;
  senderId?: number;
  scheduledAt?: string | null;
  sentAt?: string | null;
  status: EmailStatus;
  attempts?: number;
  errorMessage?: string | null;
  bullJobId?: string | null;
}

/** Shape returned by `GET /api/v1/emails/:id`, which also joins the sender. */
export interface EmailDetail extends EmailSummary {
  campaignId?: number;
  sequenceNumber?: number;
  createdAt?: string;
  sender?: {
    id: number;
    name: string;
    email: string;
  } | null;
}

export interface Sender {
  id: number;
  name?: string;
  email: string;
  hourlyLimit?: number;
}

export interface Pagination {
  count: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination?: Pagination;
}

export interface ScheduleCampaignResult {
  campaignId: number;
  leadCount: number;
  emailCount: number;
  jobsCreated: number;
}

export interface SlackStatus {
  connected: boolean;
  status: string;
  channelId?: string | null;
  connectedAt?: string | null;
  lastError?: string | null;
  lastErrorAt?: string | null;
}
