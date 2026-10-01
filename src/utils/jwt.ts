import jwt, { JwtPayload, SignOptions } from 'jsonwebtoken';
import { serverConfig } from '../config';

export type AuthTokenPayload = {
  userId: number;
  email: string;
};

const jwtSecret = (serverConfig.JWT_SECRET || 'local-dev-secret-key') as string;
const jwtOptions: SignOptions = {
  expiresIn: (serverConfig.JWT_EXPIRES_IN || '7d') as SignOptions['expiresIn'],
};

export const signAuthToken = (payload: AuthTokenPayload) => {
  return jwt.sign(payload, jwtSecret, jwtOptions);
};

export const verifyAuthToken = (token: string): JwtPayload & AuthTokenPayload => {
  return jwt.verify(token, jwtSecret) as JwtPayload & AuthTokenPayload;
};
