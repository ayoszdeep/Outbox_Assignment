import express from 'express';
import pingRouter from './ping.router';
import authRouter from './auth.router';
import senderRouter from './sender.router';
import campaignRouter from './campaign.router';
import emailStatusRouter from './email-status.router';

const v1Router = express.Router();

v1Router.use('/auth', authRouter);
v1Router.use('/ping', pingRouter);
v1Router.use('/senders', senderRouter);
v1Router.use('/campaigns', campaignRouter);
v1Router.use('/emails', emailStatusRouter);

export default v1Router;
