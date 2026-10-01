import React from 'react';
import { SignupForm } from '../components/auth/SignupForm';

export const Signup = () => {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50 dark:bg-gray-950 p-4">
      <SignupForm />
    </div>
  );
};
