import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { User } from '../../types/auth';

export type { User };

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}

const emptyState: AuthState = {
  user: null,
  token: null,
  isAuthenticated: false,
};

const getInitialState = (): AuthState => {
  const storedToken = localStorage.getItem('token');
  const storedUser = localStorage.getItem('user');

  if (!storedToken || !storedUser) {
    return emptyState;
  }

  // A half-written or stale `user` entry must not take the whole dashboard down on load.
  try {
    return {
      user: JSON.parse(storedUser) as User,
      token: storedToken,
      isAuthenticated: true,
    };
  } catch {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    return emptyState;
  }
};

const authSlice = createSlice({
  name: 'auth',
  initialState: getInitialState(),
  reducers: {
    loginAction: (state, action: PayloadAction<{ user: User; token: string }>) => {
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.isAuthenticated = true;
      localStorage.setItem('token', action.payload.token);
      localStorage.setItem('user', JSON.stringify(action.payload.user));
    },
    logoutAction: (state) => {
      state.user = null;
      state.token = null;
      state.isAuthenticated = false;
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    },
  },
});

export const { loginAction, logoutAction } = authSlice.actions;
export default authSlice.reducer;
