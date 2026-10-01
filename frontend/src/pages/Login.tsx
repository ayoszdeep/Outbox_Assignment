import React from 'react';
import { LoginForm } from '../components/auth/LoginForm';

export const Login = () => {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-4">
      <LoginForm />
    </div>
  );
};
