import { NextFunction, Request, Response } from 'express';
import { verifyAuthToken } from '../utils/jwt';

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: number;
    email: string;
  };
}

export const requireAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      message: 'Authorization token missing',
    });
    return;
  }

  try {
    const token = authHeader.replace('Bearer ', '').trim();
    const decoded = verifyAuthToken(token);

    req.user = {
      userId: Number(decoded.userId),
      email: String(decoded.email),
    };

    next();
    return;
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Invalid or expired token',
    });
    return;
  }
};
