const db: any = require('../db/models');
import nodemailer from 'nodemailer';
import { decryptText, encryptText } from '../utils/encryption';
import { serverConfig } from '../config';

export interface CreateSenderInput {
  name: string;
  email?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPassword?: string;
  hourlyLimit?: number;
}

const normalizeName = (value: string) => value?.trim();

const validateSenderInput = (data: CreateSenderInput) => {
  const name = normalizeName(data?.name || '');
  if (!name) {
    throw new Error('Sender name is required');
  }

  const port = Number(data?.smtpPort ?? 587);
  if (data?.smtpPort !== undefined && (Number.isNaN(port) || port < 1 || port > 65535)) {
    throw new Error('smtpPort must be a valid port number');
  }
};

const generateEtherealAccount = async (name: string) => {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const account = await nodemailer.createTestAccount();
    const transporter = nodemailer.createTransport({
      host: account.smtp.host,
      port: account.smtp.port,
      secure: account.smtp.secure,
      auth: {
        user: account.user,
        pass: account.pass,
      },
    });

    try {
      await transporter.verify();
      return {
        name,
        email: account.user,
        smtpHost: account.smtp.host,
        smtpPort: account.smtp.port,
        smtpUser: account.user,
        smtpPassword: account.pass,
      };
    } catch (error) {
      if (attempt === 2) {
        throw error;
      }
    }
  }

  throw new Error('Unable to create a valid Ethereal account');
};

export const getSenderTransporter = (sender: any) => {
  const smtpPassword = decryptText(sender.smtpPassword);

  return nodemailer.createTransport({
    host: sender.smtpHost,
    port: Number(sender.smtpPort || 587),
    secure: false,
    auth: {
      user: sender.smtpUser,
      pass: smtpPassword,
    },
  });
};

export const createSender = async (userId: number, data: CreateSenderInput) => {
  validateSenderInput(data);

  const senderConfig = data.smtpHost || data.smtpUser || data.smtpPassword || data.email
    ? {
        name: normalizeName(data.name),
        email: data.email || '',
        smtpHost: data.smtpHost || 'smtp.ethereal.email',
        smtpPort: Number(data.smtpPort || 587),
        smtpUser: data.smtpUser || data.email || '',
        smtpPassword: data.smtpPassword || '',
      }
    : await generateEtherealAccount(normalizeName(data.name));

  if (!senderConfig.email || !senderConfig.smtpHost || !senderConfig.smtpUser || !senderConfig.smtpPassword) {
    const generated = await generateEtherealAccount(normalizeName(data.name));
    senderConfig.email = generated.email;
    senderConfig.smtpHost = generated.smtpHost;
    senderConfig.smtpPort = generated.smtpPort;
    senderConfig.smtpUser = generated.smtpUser;
    senderConfig.smtpPassword = generated.smtpPassword;
  }

  const encryptedPassword = encryptText(senderConfig.smtpPassword);
  const hourlyLimit = Math.min(
    Math.max(1, Number(data.hourlyLimit) || serverConfig.MAX_EMAILS_PER_HOUR || 100),
    serverConfig.MAX_EMAILS_PER_HOUR || 100,
  );

  const sender = await db.Sender.create({
    userId,
    name: senderConfig.name,
    email: senderConfig.email,
    smtpHost: senderConfig.smtpHost,
    smtpPort: senderConfig.smtpPort,
    smtpUser: senderConfig.smtpUser,
    smtpPassword: encryptedPassword,
    hourlyLimit,
  });

  return {
    id: sender.id,
    name: sender.name,
    email: sender.email,
    hourlyLimit: sender.hourlyLimit,
  };
};

export const listSenders = async (userId: number) => {
  const senders = await db.Sender.findAll({
    where: { userId },
    attributes: { exclude: ['smtpPassword'] },
    order: [['createdAt', 'DESC']],
  });

  return senders.map((sender: any) => ({
    id: sender.id,
    name: sender.name,
    email: sender.email,
    hourlyLimit: sender.hourlyLimit,
  }));
};

export const deleteSender = async (userId: number, senderId: number) => {
  const deletedCount = await db.Sender.destroy({
    where: {
      id: senderId,
      userId,
    },
  });

  return deletedCount > 0;
};
