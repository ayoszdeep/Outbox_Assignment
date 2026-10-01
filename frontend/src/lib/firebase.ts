import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBRl-6hCNRuCv6qrsovSyzsecEI08-xc08",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "sender-cc29a.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "sender-cc29a",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "sender-cc29a.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "322623305983",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:322623305983:web:e0ab7339f0163e8217f4ca",
  measurementId: "G-WYJL3ZSYR1"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export { signInWithPopup };
