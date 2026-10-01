import { useEffect, useState, useRef } from 'react';
import { useSelector } from 'react-redux';
import { ChevronDown } from 'lucide-react';
import { fetchApi } from '../../services/api';
import type { RootState } from '../../store';

interface Sender {
  id: string;
  email: string;
  name?: string;
}

interface SenderSelectProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

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

  const loadSenders = async () => {
    try {
      const response = await fetchApi('/senders');
      const data = response.data || [];
      setSenders(data);
      if (data.length > 0 && !value) {
        onChange(data[0].id);
      }
    } catch (error) {
      console.error('Failed to load senders:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSenders();
  }, []);

  const handleCreateSender = async () => {
    if (!newSenderName.trim()) return;
    setIsCreating(true);
    try {
      // Sending just the name auto-generates an Ethereal account on the backend
      const response = await fetchApi('/senders', {
        method: 'POST',
        body: JSON.stringify({ name: newSenderName }),
      });
      const newSender = response.data;
      setSenders([newSender, ...senders]);
      onChange(newSender.id);
      setIsAdding(false);
      setNewSenderName('');
    } catch (error) {
      console.error('Failed to create sender:', error);
      alert('Failed to create sender. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="w-full space-y-2">
      <div className="flex justify-between items-center">
        <div></div>
        {!isAdding && !isLoading && (
          <button 
            type="button" 
            onClick={() => setIsAdding(true)}
            className="text-xs font-semibold text-green-600 hover:text-green-500 "
          >
            + Add Sender
          </button>
        )}
      </div>
      
      {isAdding ? (
        <div className="flex space-x-2">
          <input
            type="text"
            placeholder="Enter sender name (e.g. Marketing Team)"
            value={newSenderName}
            onChange={(e) => setNewSenderName(e.target.value)}
            className="flex h-10 w-full rounded-md border border-gray-200 bg-[#FFFAF0] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600   "
            autoFocus
          />
          <button
            type="button"
            onClick={handleCreateSender}
            disabled={isCreating || !newSenderName.trim()}
            className="h-10 px-4 bg-green-600 text-white rounded-md text-sm font-medium disabled:opacity-50"
          >
            {isCreating ? 'Creating...' : 'Save'}
          </button>
          <button
            type="button"
            onClick={() => setIsAdding(false)}
            className="h-10 px-4 bg-gray-200 text-gray-800   rounded-md text-sm font-medium"
          >
            Cancel
          </button>
        </div>
      ) : isLoading ? (
        <div className="flex h-10 w-full items-center rounded-md border border-gray-200 bg-[#FFFAF0] px-3 text-sm text-gray-500   ">
          Loading senders...
        </div>
      ) : senders.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-4 border border-dashed border-gray-200  rounded-md bg-[#FFFAF0] ">
          <p className="text-sm text-gray-500  mb-2">No senders configured</p>
          <button 
            type="button" 
            onClick={() => setIsAdding(true)}
            className="text-sm font-medium text-green-600 hover:text-green-700 "
          >
            Create your first sender account
          </button>
        </div>
      ) : (
        <div className="relative w-full" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className={`flex h-10 w-full items-center justify-between rounded-md border bg-[#FFFAF0] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 transition-colors ${
              error ? 'border-red-500 focus:ring-red-500' : 'border-gray-200'
            }`}
          >
            <div className="flex items-center space-x-2 overflow-hidden">
              {(() => {
                const selected = senders.find((s) => s.id === value);
                if (!selected) return <span className="text-gray-500">Select a sender</span>;
                const isCurrentUser = user && selected.email === user.email;
                return (
                  <>
                    {isCurrentUser && user.avatarUrl ? (
                      <img src={user.avatarUrl} alt="Avatar" className="w-5 h-5 shrink-0 rounded-full object-cover" />
                    ) : (
                      <div className="w-5 h-5 shrink-0 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center text-[10px] font-bold">
                        {selected.name ? selected.name.charAt(0).toUpperCase() : selected.email.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="truncate text-gray-900 font-medium">
                      {selected.name ? `${selected.name} (${selected.email})` : selected.email}
                    </span>
                  </>
                );
              })()}
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
                    onChange(sender.id);
                    setIsOpen(false);
                  }}
                  className="w-full text-left flex items-center space-x-3 px-3 py-2 text-sm hover:bg-gray-50 transition-colors"
                >
                  {(() => {
                    const isCurrentUser = user && sender.email === user.email;
                    if (isCurrentUser && user.avatarUrl) {
                      return <img src={user.avatarUrl} alt="Avatar" className="w-5 h-5 shrink-0 rounded-full object-cover" />;
                    }
                    return (
                      <div className="w-5 h-5 shrink-0 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center text-[10px] font-bold">
                        {sender.name ? sender.name.charAt(0).toUpperCase() : sender.email.charAt(0).toUpperCase()}
                      </div>
                    );
                  })()}
                  <span className="truncate text-gray-700 font-medium">
                    {sender.name ? `${sender.name} (${sender.email})` : sender.email}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      
      {error && !isAdding && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
};
