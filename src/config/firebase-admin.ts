import { App, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

let firebaseApp: App | undefined;

const getFirebaseApp = () => {
  if (firebaseApp) return firebaseApp;
  if (getApps().length > 0) {
    firebaseApp = getApps()[0];
    return firebaseApp;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || 'sender-cc29a';
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (clientEmail && privateKey) {
    firebaseApp = initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  } else {
    throw new Error('Firebase Admin credentials are not configured. Set FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY in .env');
  }

  return firebaseApp;
};

export const verifyFirebaseIdToken = async (idToken: string) => {
  if (!idToken) throw new Error('Firebase ID token is required');
  return getAuth(getFirebaseApp()).verifyIdToken(idToken);
};
