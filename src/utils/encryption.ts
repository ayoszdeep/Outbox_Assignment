import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';

const getKey = () => createHash('sha256').update(process.env.SMTP_ENCRYPTION_KEY || 'notification-service-local-dev-key-32').digest();

export const encryptText = (plainText: string): string => {
  if (!plainText) {
    return '';
  }

  const iv = randomBytes(16);
  const cipher = createCipheriv('aes-256-gcm', getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
};

export const decryptText = (cipherText: string): string => {
  if (!cipherText || !cipherText.includes(':')) {
    throw new Error('Invalid encrypted value');
  }

  const [ivHex, tagHex, encryptedHex] = cipherText.split(':');

  if (!ivHex || !tagHex || !encryptedHex) {
    throw new Error('Invalid encrypted value');
  }

  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');

  const decipher = createDecipheriv('aes-256-gcm', getKey(), iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
};
