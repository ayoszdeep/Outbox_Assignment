import { NextFunction, Request, Response } from 'express';
import { loginUser, registerUser } from '../services/auth.service';

export const signupHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await registerUser(req.body);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: user,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Registration failed';
    res.status(400).json({
      success: false,
      message,
    });
  }
};

export const signinHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await loginUser(req.body);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: user,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Login failed';
    res.status(401).json({
      success: false,
      message,
    });
  }
};
