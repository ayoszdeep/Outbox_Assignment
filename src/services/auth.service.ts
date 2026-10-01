import { hash, verify } from 'argon2';
import { signAuthToken } from '../utils/jwt';
import { verifyFirebaseIdToken } from '../config/firebase-admin';
const db = require('../db/models');

export type SignUpInput = {
  name: string;
  email: string;
  password: string;
};

export type SignInInput = {
  email: string;
  password: string;
};

const normalizeEmail = (value: string) => value.trim().toLowerCase();

export const registerUser = async ({ name, email, password }: SignUpInput) => {
  const normalizedEmail = normalizeEmail(email);

  const existingUser = await db.User.findOne({
    where: { email: normalizedEmail },
  });

  if (existingUser) {
    throw new Error('User already exists with this email');
  }

  const passwordHash = await hash(password);

  const user = await db.User.create({
    name: name.trim(),
    email: normalizedEmail,
    passwordHash,
  });

  return {
    id: user.id,
    name: user.name,
    email: user.email,
  };
};

export const loginUser = async ({ email, password }: SignInInput) => {
  const normalizedEmail = normalizeEmail(email);

  const user = await db.User.findOne({
    where: { email: normalizedEmail },
  });

  if (!user || !user.passwordHash) {
    throw new Error('Invalid email or password');
  }

  const isPasswordValid = await verify(user.passwordHash, password);

  if (!isPasswordValid) {
    throw new Error('Invalid email or password');
  }

  const token = signAuthToken({
    userId: user.id,
    email: user.email,
  });

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    token,
  };
};

export const loginWithFirebase = async (idToken: string) => {
  const firebaseUser = await verifyFirebaseIdToken(idToken);
  const email = normalizeEmail(firebaseUser.email || '');

  if (!email) {
    throw new Error('Firebase account does not contain an email address');
  }

  let user = await db.User.findOne({ where: { firebaseUid: firebaseUser.uid } });
  const existingEmailUser = await db.User.findOne({ where: { email } });

  if (user && existingEmailUser && user.id !== existingEmailUser.id) {
    throw new Error('Firebase account is linked to a different user');
  }

  user = user || existingEmailUser;
  if (!user) {
    user = await db.User.create({
      name: firebaseUser.name || email.split('@')[0],
      email,
      firebaseUid: firebaseUser.uid,
      authProvider: 'firebase-google',
      avatarUrl: firebaseUser.picture || null,
      passwordHash: null,
    });
  } else {
    await user.update({
      firebaseUid: firebaseUser.uid,
      authProvider: 'firebase-google',
      avatarUrl: firebaseUser.picture || user.avatarUrl,
    });
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    token: signAuthToken({ userId: user.id, email: user.email }),
    redirectTo: '/user',
  };
};
