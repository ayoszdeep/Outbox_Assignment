import express from 'express';
import { AuthenticatedRequest, requireAuth } from '../middlewares/auth.middleware';
import { completeSlackOAuth, disconnectSlack, getSlackConnectUrl, getSlackStatus } from '../services/slack.service';

const slackRouter = express.Router();

slackRouter.get('/connect', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    res.redirect(getSlackConnectUrl(req.user!.userId, req.user!.email));
  } catch (error) {
    res.status(503).json({
      success: false,
      message: error instanceof Error ? error.message : 'Slack is not available',
    });
  }
});

slackRouter.get('/callback', async (req, res) => {
  try {
    const code = String(req.query.code || '');
    const state = String(req.query.state || '');
    if (!code || !state) {
      res.status(400).json({ success: false, message: 'Slack code and state are required' });
      return;
    }

    const result = await completeSlackOAuth(code, state);
    res.json({ success: true, message: 'Slack connected successfully', data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Slack OAuth failed';
    // Config problems are server-side (503); a bad/expired code is the caller's (400).
    const status = message.includes('not configured on this server') ? 503 : 400;
    console.error('Slack OAuth callback failed', { message });
    res.status(status).json({ success: false, message });
  }
});

slackRouter.post('/disconnect', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const removed = await disconnectSlack(req.user!.userId);
    res.json({
      success: true,
      message: removed ? 'Slack disconnected successfully' : 'No Slack connection to disconnect',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to disconnect Slack',
    });
  }
});

slackRouter.get('/status', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    res.json({ success: true, data: await getSlackStatus(req.user!.userId) });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to read Slack status',
    });
  }
});

export default slackRouter;