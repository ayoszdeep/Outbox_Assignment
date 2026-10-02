import express from 'express';
import { AuthenticatedRequest, requireAuth } from '../middlewares/auth.middleware';
import { completeSlackOAuth, disconnectSlack, getSlackConnectUrl, getSlackStatus } from '../services/slack.service';
import { serverConfig } from '../config';

const slackRouter = express.Router();

const settingsUrl = (params: Record<string, string>) => {
  const url = new URL('/settings/slack', serverConfig.FRONTEND_URL || 'http://localhost:3005');
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return url.toString();
};

/**
 * Returns the authorize URL as JSON.
 *
 * The dashboard cannot send the user straight to `/connect`, because a top-level browser
 * navigation carries no Authorization header. So it asks for the URL with its token first,
 * then navigates to Slack itself.
 */
slackRouter.get('/connect-url', requireAuth, (req: AuthenticatedRequest, res) => {
  try {
    res.json({ success: true, data: { url: getSlackConnectUrl(req.user!.userId, req.user!.email) } });
  } catch (error) {
    res.status(503).json({
      success: false,
      message: error instanceof Error ? error.message : 'Slack is not available',
    });
  }
});

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

/**
 * Slack sends the user's browser here, so the response has to be a redirect back into the
 * dashboard rather than raw JSON. The outcome is passed on the query string.
 */
slackRouter.get('/callback', async (req, res) => {
  try {
    const code = String(req.query.code || '');
    const state = String(req.query.state || '');
    if (!code || !state) {
      res.redirect(settingsUrl({ slack: 'error', message: 'Slack code and state are required' }));
      return;
    }

    const result = await completeSlackOAuth(code, state);
    res.redirect(settingsUrl({ slack: 'connected', channel: result.channel || '' }));
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Slack OAuth failed';
    console.error('Slack OAuth callback failed', { message });
    res.redirect(settingsUrl({ slack: 'error', message }));
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