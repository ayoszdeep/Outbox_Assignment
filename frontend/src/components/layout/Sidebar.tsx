import { NavLink } from 'react-router-dom';
import { useSelector } from 'react-redux';
import type { RootState } from '../../store';
import { PenSquare, Clock, SendHorizontal, Settings } from 'lucide-react';

const navItems = [
  { name: 'Compose', path: '/compose', icon: PenSquare },
  { name: 'Scheduled', path: '/dashboard', icon: Clock },
  { name: 'Sent', path: '/dashboard/sent', icon: SendHorizontal },
];

export const Sidebar = () => {
  const user = useSelector((state: RootState) => state.auth.user);

  return (
    <aside className="w-64 border-r border-gray-200 bg-[#FFFAF0] flex flex-col h-full text-gray-900">
      <div className="p-4 border-b border-gray-200 flex items-center">
        <NavLink to="/dashboard" className="hover:opacity-80 transition-opacity">
          <h1 className="text-xl font-bold tracking-tight text-gray-900">OMB</h1>
        </NavLink>
      </div>

      <NavLink
        to="/settings"
        className="p-4 border-b border-gray-200 flex items-center justify-between group cursor-pointer hover:bg-green-50/60 transition-colors"
      >
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
        <Settings className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
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
              `flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors border border-transparent ${
                isActive
                  ? 'bg-green-100 text-green-800 border-green-300'
                  : 'text-gray-600 hover:bg-green-50 hover:text-green-700'
              }`
            }
          >
            <item.icon className="w-4 h-4 mr-3" />
            <span>{item.name}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-200">
        <NavLink
          to="/settings/slack"
          className="flex items-center px-3 py-2 rounded-md text-sm font-medium text-gray-600 hover:bg-green-50 hover:text-green-700 transition-colors"
        >
          <Settings className="w-4 h-4 mr-3" />
          Settings
        </NavLink>
      </div>
    </aside>
  );
};
