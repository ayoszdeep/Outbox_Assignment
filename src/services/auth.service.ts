import { hash, verify } from 'argon2';
import { signAuthToken } from '../utils/jwt';
import { verifyFirebaseIdToken } from '../config/firebase-admin';
import { createSender } from './sender.service';
import logger from '../config/logger.config';
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

/**
 * Every new account gets one real, working Ethereal sender so the dashboard is usable
 * straight after the first login.
 *
 * Ethereal is a third-party service, so this is deliberately non-fatal: if it cannot be
 * reached we log it and let the signup succeed. The user can still add a sender from the
 * Compose screen, which runs the same code path.
 */
const provisionDefaultSender = async (user: any) => {
  try {
    await createSender(user.id, { name: user.name });
  } catch (error) {
    logger.error('Could not provision a default Ethereal sender for the new user', {
      userId: user.id,
      message: error instanceof Error ? error.message : 'unknown error',
    });
  }
};

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

  await provisionDefaultSender(user);

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatarUrl: user.avatarUrl,
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
    avatarUrl: user.avatarUrl,
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

    await provisionDefaultSender(user);
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
    avatarUrl: user.avatarUrl,
    token: signAuthToken({ userId: user.id, email: user.email }),
    redirectTo: '/dashboard',
  };
};
