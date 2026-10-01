import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { createSender, deleteSender, listSenders } from '../services/sender.service';

export const createSenderHandler = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const sender = await createSender(userId, req.body);

    res.status(201).json({
      success: true,
      data: sender,
    });
    return;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create sender';
    res.status(400).json({ success: false, message });
    return;
  }
};

export const listSendersHandler = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    const senders = await listSenders(userId);

    res.status(200).json({
      success: true,
      data: senders,
    });
    return;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load senders';
    res.status(400).json({ success: false, message });
    return;
  }
};

export const deleteSenderHandler = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const senderId = Number(req.params.id);

    if (!userId) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    if (!Number.isInteger(senderId) || senderId <= 0) {
      res.status(400).json({ success: false, message: 'Invalid sender id' });
      return;
    }

    const wasDeleted = await deleteSender(userId, senderId);

    if (!wasDeleted) {
      res.status(404).json({ success: false, message: 'Sender not found' });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Sender deleted successfully',
    });
    return;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete sender';
    res.status(400).json({ success: false, message });
    return;
  }
};
