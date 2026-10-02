import { useCallback, useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { createSender, getSenders } from '../../services/emailApi';
import type { Sender } from '../../types/email';
import type { RootState } from '../../store';
import { Avatar } from '../ui/Avatar';

interface SenderSelectProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

const senderLabel = (sender: Sender) => (sender.name ? `${sender.name} (${sender.email})` : sender.email);

export const SenderSelect: React.FC<SenderSelectProps> = ({ value, onChange, error }) => {
  const user = useSelector((state: RootState) => state.auth.user);
  const [senders, setSenders] = useState<Sender[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newSenderName, setNewSenderName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadSenders = useCallback(async () => {
    try {
      const response = await getSenders();
      const data = response.data || [];
      setSenders(data);
      // Pre-select the first sender so the common case needs no extra click.
      if (data.length > 0 && !value) onChange(String(data[0].id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load senders');
    } finally {
      setIsLoading(false);
    }
    // onChange/value are intentionally left out: this must run once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void loadSenders();
  }, [loadSenders]);

  const handleCreateSender = async () => {
    if (!newSenderName.trim()) return;
    setIsCreating(true);

    try {
      // Only the name is sent: the backend provisions a real Ethereal SMTP mailbox for it.
      const response = await createSender(newSenderName.trim());
      setSenders([response.data, ...senders]);
      onChange(String(response.data.id));
      setIsAdding(false);
      setNewSenderName('');
      toast.success(`Sender ready: ${response.data.email}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create sender');
    } finally {
      setIsCreating(false);
    }
  };

  const selected = senders.find((sender) => String(sender.id) === String(value));

  const avatarFor = (sender: Sender) => (
    <Avatar
      src={user && sender.email === user.email ? user.avatarUrl : null}
      name={sender.name || sender.email}
      className="w-5 h-5"
      textClassName="text-[10px]"
      alt=""
    />
  );

  if (isAdding) {
    return (
      <div className="flex space-x-2">
        <input
          type="text"
          placeholder="Sender name (e.g. Marketing Team)"
          value={newSenderName}
          onChange={(e) => setNewSenderName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void handleCreateSender();
            }
          }}
          className="flex h-10 w-full rounded-md border border-gray-200 bg-[#FFFAF0] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
          autoFocus
        />
        <button
          type="button"
          onClick={() => void handleCreateSender()}
          disabled={isCreating || !newSenderName.trim()}
          className="h-10 px-4 bg-green-600 text-white rounded-md text-sm font-medium disabled:opacity-50 shrink-0"
        >
          {isCreating ? 'Creating...' : 'Save'}
        </button>
        <button
          type="button"
          onClick={() => setIsAdding(false)}
          className="h-10 px-4 bg-gray-200 text-gray-800 rounded-md text-sm font-medium shrink-0"
        >
          Cancel
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-10 w-full items-center rounded-md border border-gray-200 bg-[#FFFAF0] px-3 text-sm text-gray-500">
        Loading senders...
      </div>
    );
  }

  if (senders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-4 border border-dashed border-gray-200 rounded-md bg-[#FFFAF0]">
        <p className="text-sm text-gray-500 mb-2">No senders configured</p>
        <button
          type="button"
          onClick={() => setIsAdding(true)}
          className="text-sm font-medium text-green-600 hover:text-green-700"
        >
          Create your first sender account
        </button>
      </div>
    );
  }

  return (
    <div className="w-full space-y-2">
      <div className="relative w-full" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`flex h-10 w-full items-center justify-between rounded-md border bg-[#FFFAF0] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 transition-colors ${
            error ? 'border-red-500 focus:ring-red-500' : 'border-gray-200'
          }`}
        >
          <div className="flex items-center space-x-2 overflow-hidden">
            {selected ? (
              <>
                {avatarFor(selected)}
                <span className="truncate text-gray-900 font-medium">{senderLabel(selected)}</span>
              </>
            ) : (
              <span className="text-gray-500">Select a sender</span>
            )}
          </div>
          <ChevronDown className="w-4 h-4 text-gray-500 shrink-0 ml-2" />
        </button>

        {isOpen && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto py-1">
            {senders.map((sender) => (
              <button
                key={sender.id}
                type="button"
                onClick={() => {
                  onChange(String(sender.id));
                  setIsOpen(false);
                }}
                className="w-full text-left flex items-center space-x-3 px-3 py-2 text-sm hover:bg-gray-50 transition-colors"
              >
                {avatarFor(sender)}
                <span className="truncate text-gray-700 font-medium">{senderLabel(sender)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        {error ? <p className="text-sm text-red-500">{error}</p> : <span />}
        <button
          type="button"
          onClick={() => setIsAdding(true)}
          className="text-xs font-semibold text-green-600 hover:text-green-500"
        >
          + Add Sender
        </button>
      </div>
    </div>
  );
};
