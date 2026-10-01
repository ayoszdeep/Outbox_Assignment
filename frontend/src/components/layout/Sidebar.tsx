
import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import type { RootState } from '../../store';
import { logoutAction } from '../../store/slices/authSlice';
import { PenSquare, Clock, SendHorizontal, LogOut, Settings, Moon, Sun } from 'lucide-react';
import { Button } from '../ui/Button';

import { auth } from '../../lib/firebase';
import { signOut } from 'firebase/auth';

export const Sidebar = () => {
  const user = useSelector((state: RootState) => state.auth.user);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    // Check local storage or system preference on mount
    const isDark = localStorage.getItem('theme') === 'dark' || 
                   (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches);
    setIsDarkMode(isDark);
    if (isDark) {
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleTheme = () => {
    if (isDarkMode) {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      setIsDarkMode(false);
    } else {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      setIsDarkMode(true);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.error('Firebase signout failed', e);
    }
    dispatch(logoutAction());
    navigate('/login');
  };

  const navItems = [
    { name: 'Compose', path: '/compose', icon: PenSquare },
    { name: 'Scheduled', path: '/dashboard', icon: Clock, count: 0 },
    { name: 'Sent', path: '/dashboard/sent', icon: SendHorizontal, count: 0 },
  ];

  return (
    <aside className="w-64 border-r border-gray-200 bg-[#FFFAF0] flex flex-col h-full text-gray-900">
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <NavLink to="/dashboard" className="hover:opacity-80 transition-opacity">
          <h1 className="text-xl font-bold tracking-tight text-gray-900">OMB</h1>
        </NavLink>
        <button 
          onClick={toggleTheme} 
          className="p-1.5 rounded-full text-gray-500 hover:bg-gray-200 transition-colors"
          title="Toggle Dark Mode"
        >
          {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>

      <NavLink to="/settings" className="p-4 border-b border-gray-200 flex items-center justify-between group cursor-pointer hover:bg-[#FFFAF0] transition-colors block">
        <div className="flex items-center space-x-3 overflow-hidden">
          {user?.avatarUrl ? (
            <img 
              src={user.avatarUrl} 
              alt={user?.name || 'User'} 
              className="w-8 h-8 rounded-full object-cover shrink-0 border border-gray-200"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 font-bold shrink-0 border border-gray-200">
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
          )}
          <div className="truncate">
            <p className="text-sm font-medium text-gray-900 truncate">{user?.name || 'User'}</p>
            <p className="text-xs text-gray-500 truncate">{user?.email}</p>
          </div>
        </div>
        <Settings className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
      </NavLink>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-3">
          Core
        </p>
        {navItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            end={item.path === '/dashboard'}
            className={({ isActive }) =>
              `flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium transition-colors border border-transparent ${
                isActive
                  ? 'bg-green-100 text-green-800 border-green-300'
                  : 'text-gray-600 hover:bg-green-50 hover:text-green-700'
              }`
            }
          >
            <div className="flex items-center space-x-3">
              <item.icon className="w-4 h-4" />
              <span>{item.name}</span>
            </div>
            {item.count !== undefined && item.count !== 0 && (
              <span className="bg-gray-100 text-gray-500 py-0.5 px-2 rounded-full text-xs border border-gray-200">
                {item.count}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-200">
        <Button variant="ghost" className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50" onClick={handleLogout}>
          <LogOut className="w-4 h-4 mr-2" />
          Logout
        </Button>
      </div>
    </aside>
  );
};
