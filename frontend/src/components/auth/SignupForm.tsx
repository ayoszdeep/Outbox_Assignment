import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Mail, Lock, User } from 'lucide-react';
import { loginAction } from '../../store/slices/authSlice';
import { auth, googleProvider, signInWithPopup } from '../../lib/firebase';

export const SignupForm = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const handleGoogleSignup = async () => {
    setIsLoading(true);
    setError('');
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const idToken = await result.user.getIdToken();
      
      const response = await fetch('/api/v1/auth/firebase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });

      if (!response.ok) {
        throw new Error('Failed to authenticate with backend');
      }

      const data = await response.json();
      dispatch(loginAction({
        user: { 
          id: data.data?.user?.id || '1', 
          name: data.data?.user?.name || result.user.displayName || 'User', 
          email: data.data?.user?.email || result.user.email,
          avatarUrl: data.data?.user?.avatarUrl || data.data?.avatarUrl || result.user.photoURL || null
        },
        token: data.data?.token || 'mock_token'
      }));
      navigate('/dashboard');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Google sign-up failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/v1/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, email, password }),
      });

      if (!response.ok) {
        throw new Error('Failed to create account');
      }

      // Automatically sign in directly after creation
      const signInResponse = await fetch('/api/v1/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!signInResponse.ok) {
        throw new Error('Account created, but failed to log in automatically');
      }

      const data = await signInResponse.json();
      
      if (!data.data?.token) {
        throw new Error('Authentication failed: No token received from backend');
      }

      dispatch(loginAction({
        user: { 
          id: data.data.id || '1', 
          name: data.data.name || name, 
          email: data.data.email || email,
          avatarUrl: data.data.avatarUrl || null
        },
        token: data.data.token
      }));

      navigate('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
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

      <Button 
        type="button"
        onClick={handleGoogleSignup} 
        disabled={isLoading}
        className="w-full bg-[#FFFAF0] border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
      >
        <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        Sign up with Google
      </Button>

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
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="pl-10"
            />
            <Lock className="w-5 h-5 text-gray-400 absolute left-3 top-9" />
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
