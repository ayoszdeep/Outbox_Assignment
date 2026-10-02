import type { EmailStatus } from '../../types/email';

const STYLES: Record<EmailStatus, { label: string; className: string }> = {
  scheduled: { label: 'Scheduled', className: 'bg-amber-50 text-amber-700' },
  processing: { label: 'Sending', className: 'bg-blue-50 text-blue-700' },
  sent: { label: 'Sent', className: 'bg-green-50 text-green-700' },
  failed: { label: 'Failed', className: 'bg-red-50 text-red-700' },
};

/** One place that decides how every email status is worded and coloured. */
export const StatusBadge: React.FC<{ status: EmailStatus }> = ({ status }) => {
  const style = STYLES[status] ?? { label: status, className: 'bg-gray-100 text-gray-600' };

  return (
    <span
      className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-xs font-semibold shrink-0 ${style.className}`}
    >
      {style.label}
    </span>
  );
};
