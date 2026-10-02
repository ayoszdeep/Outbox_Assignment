export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
}

/** `data` payload of the backend's signin / signup / firebase auth responses. */
export interface AuthPayload {
  id: number | string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  token: string;
}

export interface AuthResult {
  user: User;
  token: string;
}
