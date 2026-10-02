import { auth, googleProvider, signInWithPopup } from '../lib/firebase';
import type { AuthPayload, AuthResult } from '../types/auth';

const post = async (endpoint: string, body: unknown): Promise<AuthPayload> => {
  const response = await fetch(`/api/v1${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const json = await response.json().catch(() => ({}));

  if (!response.ok || !json?.success) {
    throw new Error(json?.message || 'Authentication failed');
  }

  return json.data as AuthPayload;
};

/**
 * The backend is the only source of the session token, so a missing token is an error
 * rather than something to paper over with a placeholder.
 */
const toAuthResult = (payload: AuthPayload, fallback?: Partial<AuthResult['user']>): AuthResult => {
  if (!payload?.token) {
    throw new Error('Authentication failed: no token received from the server');
  }

  return {
    token: payload.token,
    user: {
      id: String(payload.id ?? fallback?.id ?? ''),
      name: payload.name || fallback?.name || 'User',
      email: payload.email || fallback?.email || '',
      avatarUrl: payload.avatarUrl ?? fallback?.avatarUrl ?? null,
    },
  };
};

export const signInWithEmail = async (email: string, password: string): Promise<AuthResult> =>
  toAuthResult(await post('/auth/signin', { email, password }), { email });

/**
 * Signup does not return a token, so the new account is signed in straight afterwards
 * through the normal login path.
 */
export const signUpWithEmail = async (name: string, email: string, password: string): Promise<AuthResult> => {
  await post('/auth/signup', { name, email, password });
  return signInWithEmail(email, password);
};

/**
 * Real Google OAuth: Firebase runs the Google consent flow in a popup, and the resulting
 * Google ID token is verified server-side by the Firebase Admin SDK before the backend
 * issues its own JWT. Shared by the login and signup screens.
 */
export const signInWithGoogle = async (): Promise<AuthResult> => {
  const credential = await signInWithPopup(auth, googleProvider);
  const idToken = await credential.user.getIdToken();
  const payload = await post('/auth/firebase', { idToken });

  return toAuthResult(payload, {
    name: credential.user.displayName || undefined,
    email: credential.user.email || undefined,
    avatarUrl: credential.user.photoURL,
  });
};
