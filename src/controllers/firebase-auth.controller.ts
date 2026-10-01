import { Request, Response } from 'express';
import { loginWithFirebase } from '../services/auth.service';

export const firebaseSigninHandler = async (req: Request, res: Response) => {
  try {
    const result = await loginWithFirebase(String(req.body?.idToken || ''));
    res.status(200).json({
      success: true,
      message: 'Firebase Google sign-in successful',
      data: result,
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      message: error instanceof Error ? error.message : 'Firebase sign-in failed',
    });
  }
};