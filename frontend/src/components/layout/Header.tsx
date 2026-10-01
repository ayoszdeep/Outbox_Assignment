import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { Search, Filter, RefreshCw } from 'lucide-react';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';

export const Header = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = useState(searchParams.get('search') || '');

  // Keep internal state synced with URL
  useEffect(() => {
    setQuery(searchParams.get('search') || '');
  }, [searchParams]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!location.pathname.includes('/dashboard')) {
      navigate(query.trim() ? `/dashboard?search=${encodeURIComponent(query.trim())}` : '/dashboard');
    } else {
      if (query.trim()) {
        setSearchParams({ search: query.trim() });
      } else {
        searchParams.delete('search');
        setSearchParams(searchParams);
      }
    }
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <header className="h-16 border-b border-gray-200 bg-[#FFFAF0] flex items-center justify-between px-6 shrink-0 shadow-sm z-10">
      <form onSubmit={handleSearch} className="flex-1 max-w-2xl flex items-center space-x-6">
        <div className="relative w-full group shadow-sm border border-gray-200 hover:shadow-md hover:border-gray-300 transition-all duration-300 rounded-lg bg-white overflow-hidden">
          <Input 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search" 
            className="pl-12 bg-white border-none focus:bg-white focus:ring-0 focus:outline-none transition-all rounded-lg h-[46px] w-full text-[15px] text-gray-700 placeholder-gray-400"
          />
          <Search className="w-5 h-5 text-gray-400 absolute left-4 top-3 transition-colors group-focus-within:text-green-500" />
          <button type="submit" className="hidden">Search</button>
        </div>
        <div className="flex items-center space-x-4">
          <button type="button" className="text-gray-500 hover:text-gray-700 transition-colors cursor-pointer" title="Filter">
            <Filter className="w-5 h-5" />
          </button>
          <button type="button" onClick={handleRefresh} className="text-gray-500 hover:text-gray-700 transition-colors cursor-pointer" title="Refresh">
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </form>
    </header>
  );
};
