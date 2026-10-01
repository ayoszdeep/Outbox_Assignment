import express from 'express';
import { createSenderHandler, deleteSenderHandler, listSendersHandler } from '../../controllers/sender.controller';
import { requireAuth } from '../../middlewares/auth.middleware';

const senderRouter = express.Router();

senderRouter.use(requireAuth);
senderRouter.post('/', createSenderHandler);
senderRouter.get('/', listSendersHandler);
senderRouter.delete('/:id', deleteSenderHandler);

export default senderRouter;
