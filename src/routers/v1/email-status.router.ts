import express from 'express';
import { requireAuth, AuthenticatedRequest } from '../../middlewares/auth.middleware';
import { listEmails, scheduleSingleEmail } from '../../services/email.service';
import { searchIndexedEmails } from '../../services/email-search.service';

const emailStatusRouter = express.Router();

emailStatusRouter.use(requireAuth);

emailStatusRouter.post('/schedule', async (req: AuthenticatedRequest, res) => {
  try {
    const result = await scheduleSingleEmail(req.user!.userId, req.body);
    res.status(201).json({ success: true, message: 'Email scheduled successfully', data: result });
  } catch (error) {
    res.status(400).json({ success: false, message: error instanceof Error ? error.message : 'Failed to schedule email' });
  }
});

emailStatusRouter.get('/', async (req: AuthenticatedRequest, res) => {
  try {
    const status = req.query.status ? String(req.query.status) : undefined;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const result = await listEmails(req.user!.userId, status, page, limit);
    res.json({ success: true, data: result.rows, pagination: { count: result.count, page: result.page, limit: result.limit, totalPages: result.totalPages } });
  } catch (error) {
    res.status(500).json({ success: false, message: error instanceof Error ? error.message : 'Failed to list emails' });
  }
});

emailStatusRouter.get('/search', async (req: AuthenticatedRequest, res) => {
  const query = String(req.query.q || '').trim();
  if (!query) {
    res.json({ success: true, data: [] });
    return;
  }

  try {
    const result = await searchIndexedEmails(req.user!.userId, query);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(503).json({ success: false, message: 'Email search is unavailable' });
  }
});

export default emailStatusRouter;
