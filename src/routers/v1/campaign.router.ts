import express from 'express';
import multer from 'multer';
import { scheduleCampaignHandler } from '../../controllers/campaign.controller';
import { requireAuth } from '../../middlewares/auth.middleware';

const upload = multer({ storage: multer.memoryStorage() });
const campaignRouter = express.Router();

campaignRouter.use(requireAuth);
campaignRouter.post('/schedule', upload.single('file'), scheduleCampaignHandler);

export default campaignRouter;
