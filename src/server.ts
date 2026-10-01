import express from 'express';
import { serverConfig } from './config';
import v1Router from './routers/v1/index.router';
import { appErrorHandler, genericErrorHandler } from './middlewares/error.middleware';
import logger from './config/logger.config';
import { attachCorrelationIdMiddleware } from './middlewares/correlation.middleware';
import { connectDatabase } from './config/database.config';
import slackRouter from './routers/slack.router';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { emailSchedulerQueue } from './queues/mailer.queues';
import { ensureSearchIndex } from './services/email-search.service';
import { reconcileScheduledEmails } from './services/queue-reconciliation.service';

const app = express();
const bullBoardAdapter = new ExpressAdapter();
bullBoardAdapter.setBasePath('/admin/queues');
createBullBoard({
    queues: [new BullMQAdapter(emailSchedulerQueue)],
    serverAdapter: bullBoardAdapter,
});

app.use(express.json());

/**
 * Registering all the routers and their corresponding routes with out app server object.
 */

app.use(attachCorrelationIdMiddleware);
app.use('/api/v1', v1Router);
app.use('/api/slack', slackRouter);
app.use('/admin/queues', bullBoardAdapter.getRouter());


/**
 * Add the error handler middleware
 */

app.use(appErrorHandler);
app.use(genericErrorHandler);


/**
 * The API process owns HTTP, indexing and reconciliation only. The scheduled-email
 * worker runs as its own process (`npm run worker`) so it can be scaled or restarted
 * independently of the API.
 */
app.listen(serverConfig.PORT, async () => {
    try {
        await connectDatabase();
        logger.info('PostgreSQL connection established successfully.');
        await ensureSearchIndex();
        const repairedJobs = await reconcileScheduledEmails();
        logger.info(`Scheduled email reconciliation completed: ${repairedJobs} jobs repaired.`);
    } catch (error) {
        logger.error('Failed to connect to PostgreSQL:', error);
    }

    logger.info(`Server is running on http://localhost:${serverConfig.PORT}`);
    logger.info(`Press Ctrl+C to stop the server.`);
    logger.info(`Start the email worker separately with: npm run worker`);
});
