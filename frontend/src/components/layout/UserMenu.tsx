import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { LogOut } from 'lucide-react';
import { signOut } from 'firebase/auth';
import type { RootState } from '../../store';
import { logoutAction } from '../../store/slices/authSlice';
import { auth } from '../../lib/firebase';
import { Button } from '../ui/Button';
import { Avatar } from '../ui/Avatar';

/**
 * Name, email, avatar and logout for the top header.
 *
 * Logout clears the Firebase session as well as the local one, so a Google user is not
 * silently signed straight back in by the popup on the next attempt. A Firebase failure
 * must not trap the user in the app, so the local session is cleared either way.
 */
export const UserMenu = () => {
  const user = useSelector((state: RootState) => state.auth.user);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Firebase sign-out failed', error);
    }

    dispatch(logoutAction());
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex items-center space-x-4 shrink-0">
      <div className="flex items-center space-x-3 overflow-hidden">
        <Avatar
          src={user?.avatarUrl}
          name={user?.name}
          email={user?.email}
          className="w-9 h-9"
          textClassName="text-sm"
        />
        <div className="hidden sm:block truncate max-w-[180px] text-right">
          <p className="text-sm font-medium text-gray-900 truncate">{user?.name || 'User'}</p>
          <p className="text-xs text-gray-500 truncate">{user?.email}</p>
        </div>
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={handleLogout}
        className="text-red-600 hover:text-red-700 hover:bg-red-50"
        title="Log out"
      >
        <LogOut className="w-4 h-4 sm:mr-2" />
        <span className="hidden sm:inline">Logout</span>
      </Button>
    </div>
  );
};
