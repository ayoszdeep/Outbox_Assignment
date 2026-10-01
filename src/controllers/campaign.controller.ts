import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { scheduleCampaign } from '../services/campaign.service';

export const scheduleCampaignHandler = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user?.userId) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const result = await scheduleCampaign(req.user.userId, req.body, req.file);

    res.status(201).json({
      success: true,
      message: 'Campaign scheduled successfully',
      data: result,
    });
    return;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to schedule campaign';
    const statusCode = message.toLowerCase().includes('sender') && message.toLowerCase().includes('not found') ? 404 : 400;

    res.status(statusCode).json({
      success: false,
      message,
    });
    return;
  }
};
