import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from './store';
import { AppLayout } from './components/layout/AppLayout';
import { Login } from './pages/Login';
import { Signup } from './pages/Signup';
import { Dashboard } from './pages/Dashboard';
import { Compose } from './pages/Compose';
import { EmailDetailPage } from './pages/EmailDetailPage';
import { Settings } from './pages/Settings';

import { Toaster } from 'react-hot-toast';

function App() {
  return (
    <Provider store={store}>
      <Toaster position="bottom-right" toastOptions={{ className: 'text-sm font-medium' }} />
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          
          {/* Protected Routes */}
          <Route element={<AppLayout />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/dashboard/sent" element={<Dashboard />} />
            <Route path="/compose" element={<Compose />} />
            <Route path="/email/:id" element={<EmailDetailPage />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/settings/slack" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </Provider>
  );
}

export default App;

