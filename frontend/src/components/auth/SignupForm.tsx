import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Mail, Lock, User, Eye, EyeOff } from 'lucide-react';
import { loginAction } from '../../store/slices/authSlice';
import { signInWithGoogle, signUpWithEmail } from '../../services/authApi';
import type { AuthResult } from '../../types/auth';
import { GoogleButton } from './GoogleButton';

export const SignupForm = () => {
  const [name, setName] = useState('');
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
    void runAuth(() => signUpWithEmail(name, email, password));
  };

  return (
    <div className="w-full max-w-md space-y-8 bg-[#FFFAF0] p-8 rounded-xl shadow-lg border border-gray-200">
      <div className="text-center">
        <h2 className="text-3xl font-bold tracking-tight text-gray-900">Create Account</h2>
        <p className="mt-2 text-sm text-gray-600">
          Get started with Outbox today
        </p>
      </div>

      {error && (
        <div className="p-3 text-sm text-red-500 bg-red-50 rounded-md">
          {error}
        </div>
      )}

      <GoogleButton
        label="Sign up with Google"
        disabled={isLoading}
        onClick={() => void runAuth(signInWithGoogle)}
      />

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-[#FFFAF0] text-gray-500">Or sign up with email</span>
        </div>
      </div>

      <form className="space-y-6" onSubmit={handleSubmit}>
        <div className="space-y-4">
          <div className="relative">
            <Input
              label="Name"
              type="text"
              required
              minLength={2}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="John Doe"
              className="pl-10"
            />
            <User className="w-5 h-5 text-gray-400 absolute left-3 top-9" />
          </div>

          <div className="relative">
            <Input
              label="Email"
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
              placeholder="At least 8 characters"
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
          {isLoading ? 'Creating account...' : 'Sign Up'}
        </Button>

        <p className="text-center text-sm text-gray-600">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-green-600 hover:text-green-500">
            Login
          </Link>
        </p>
      </form>
    </div>
  );
};
