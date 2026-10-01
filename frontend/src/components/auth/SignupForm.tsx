import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Mail, Lock, User } from 'lucide-react';

export const SignupForm = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // TODO: Replace with real auth call
      const response = await fetch('http://127.0.0.1:3001/api/v1/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, email, password }),
      });

      if (!response.ok) {
        throw new Error('Failed to create account');
      }

      console.log('Account created');
      navigate('/login');
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md space-y-8 bg-white dark:bg-gray-900 p-8 rounded-xl shadow-lg border border-gray-100 dark:border-gray-800">
      <div className="text-center">
        <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Create Account</h2>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Get started with Outbox today
        </p>
      </div>

      <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
        {error && (
          <div className="p-3 text-sm text-red-500 bg-red-50 dark:bg-red-900/10 rounded-md">
            {error}
          </div>
        )}
        
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

        <p className="text-center text-sm text-gray-600 dark:text-gray-400">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">
            Login
          </Link>
        </p>
      </form>
    </div>
  );
};
