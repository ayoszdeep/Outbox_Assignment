import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { loginAction } from '../../store/slices/authSlice';
import { signInWithEmail, signInWithGoogle } from '../../services/authApi';
import type { AuthResult } from '../../types/auth';
import { GoogleButton } from './GoogleButton';

export const LoginForm = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const runAuth = async (authenticate: () => Promise<AuthResult>) => {
    setIsLoading(true);
    setError('');

    try {
      dispatch(loginAction(await authenticate()));
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void runAuth(() => signInWithEmail(email, password));
  };

  return (
    <div className="w-full max-w-md space-y-8 bg-[#FFFAF0] p-8 rounded-xl shadow-lg border border-gray-200">
      <div className="text-center">
        <h2 className="text-3xl font-bold tracking-tight text-gray-900">Login</h2>
        <p className="mt-2 text-sm text-gray-600">
          Welcome back to Outbox
        </p>
      </div>

      {error && (
        <div className="p-3 text-sm text-red-500 bg-red-50 rounded-md">
          {error}
        </div>
      )}

      <GoogleButton
        label="Continue with Google"
        disabled={isLoading}
        onClick={() => void runAuth(signInWithGoogle)}
      />

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-[#FFFAF0] text-gray-500">Or continue with email</span>
        </div>
      </div>

      <form className="space-y-6" onSubmit={handleSubmit}>
        <div className="space-y-4">
          <div className="relative">
            <Input
              label="Email ID"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@example.com"
              className="pl-10"
            />
            <Mail className="w-5 h-5 text-gray-400 absolute left-3 top-9" />
          </div>

          <div className="relative">
            <Input
              label="Password"
              type={showPassword ? 'text' : 'password'}
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="pl-10 pr-11"
            />
            <Lock className="w-5 h-5 text-gray-400 absolute left-3 top-9" />
            <button
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              className="absolute right-3 top-9 text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              title={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <Button type="submit" className="w-full" isLoading={isLoading}>
          {isLoading ? 'Signing in...' : 'Login'}
        </Button>

        <p className="text-center text-sm text-gray-600">
          Don't have an account?{' '}
          <Link to="/signup" className="font-semibold text-green-600 hover:text-green-500">
            Sign up
          </Link>
        </p>
      </form>
    </div>
  );
};
