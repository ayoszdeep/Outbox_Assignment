
import dotenv from 'dotenv';

type ServerConfig = {
    PORT: number,
    REDIS_PORT?: number,
    REDIS_HOST?: string,
    MAIL_PASS?: string,
    MAIL_USER?: string,
    DB_HOST?: string,
    DB_PORT?: number,
    DB_NAME?: string,
    DB_USER?: string,
    DB_PASSWORD?: string,
    DB_DIALECT?: string,
    DB_SSL?: boolean,
    JWT_SECRET?: string,
    JWT_EXPIRES_IN?: string,
    WORKER_CONCURRENCY?: number,
    MIN_DELAY_MS?: number,
    MAX_EMAILS_PER_HOUR?: number,
    SLACK_CLIENT_ID?: string,
    SLACK_CLIENT_SECRET?: string,
    SLACK_REDIRECT_URI?: string,
    ELASTICSEARCH_URL?: string,
    ELASTICSEARCH_INDEX?: string,
}

function loadEnv() {
    dotenv.config();
    console.log(`Environment variables loaded`);
}

loadEnv();

export const serverConfig: ServerConfig = {
    PORT: Number(process.env.PORT) || 3001,
    REDIS_PORT: process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : 6379,
    REDIS_HOST: process.env.REDIS_HOST || 'localhost',
    MAIL_PASS: process.env.EMAIL_PASS || '',
    MAIL_USER: process.env.EMAIL_USER || '',
    DB_HOST: process.env.DB_HOST || 'localhost',
    DB_PORT: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
    DB_NAME: process.env.DB_NAME || 'postgres',
    DB_USER: process.env.DB_USER || 'postgres',
    DB_PASSWORD: process.env.DB_PASSWORD || 'postgres',
    DB_DIALECT: process.env.DB_DIALECT || 'postgres',
    DB_SSL: process.env.DB_SSL === 'true',
    JWT_SECRET: process.env.JWT_SECRET || 'local-dev-secret-key',
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
    WORKER_CONCURRENCY: Number(process.env.WORKER_CONCURRENCY) || 1,
    MIN_DELAY_MS: Number(process.env.MIN_DELAY_MS) || 2000,
    MAX_EMAILS_PER_HOUR: Number(process.env.MAX_EMAILS_PER_HOUR) || 100,
    SLACK_CLIENT_ID: process.env.SLACK_CLIENT_ID || '',
    SLACK_CLIENT_SECRET: process.env.SLACK_CLIENT_SECRET || '',
    SLACK_REDIRECT_URI: process.env.SLACK_REDIRECT_URI || `http://localhost:${Number(process.env.PORT) || 3001}/api/slack/callback`,
    ELASTICSEARCH_URL: process.env.ELASTICSEARCH_URL || 'http://127.0.0.1:9200',
    ELASTICSEARCH_INDEX: process.env.ELASTICSEARCH_INDEX || 'emails',
};