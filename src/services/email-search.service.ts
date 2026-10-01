import { Client } from '@elastic/elasticsearch';
import { serverConfig } from '../config';

const db: any = require('../db/models');

const elasticsearchUrl = serverConfig.ELASTICSEARCH_URL || 'http://127.0.0.1:9200';
const client = new Client({ node: elasticsearchUrl });
const index = serverConfig.ELASTICSEARCH_INDEX || 'emails';

export const ensureSearchIndex = async () => {
  try {
    const exists = await client.indices.exists({ index });
    if (!exists) {
      await client.indices.create({
        index,
        mappings: {
          properties: {
            id: { type: 'integer' },
            userId: { type: 'integer' },
            recipient: { type: 'text' },
            subject: { type: 'text' },
            body: { type: 'text' },
            status: { type: 'keyword' },
            senderId: { type: 'integer' },
            scheduledAt: { type: 'date' },
            sentAt: { type: 'date' },
          },
        },
      });
    }
  } catch (error: any) {
    console.error('Elasticsearch index unavailable', { message: error?.message || 'unknown error' });
  }
};

const toDocument = (email: any) => ({
  id: email.id,
  userId: email.userId,
  recipient: email.recipient,
  subject: email.subject,
  body: email.body,
  status: email.status,
  senderId: email.senderId,
  scheduledAt: email.scheduledAt,
  sentAt: email.sentAt,
});

export const indexEmail = async (email: any) => {
  try {
    await client.index({ index, id: String(email.id), document: toDocument(email), refresh: 'wait_for' });
  } catch (error: any) {
    console.error('Elasticsearch indexing failed', { emailId: email.id, message: error?.message || 'unknown error' });
  }
};

export const updateIndexedEmail = async (emailId: number) => {
  try {
    const email = await db.Email.findByPk(emailId);
    if (!email) return;
    await client.index({ index, id: String(email.id), document: toDocument(email), refresh: 'wait_for' });
  } catch (error: any) {
    console.error('Elasticsearch update failed', { emailId, message: error?.message || 'unknown error' });
  }
};

export const searchIndexedEmails = async (userId: number, query: string) => {
  const response = await client.search({
    index,
    query: {
      bool: {
        filter: [{ term: { userId } }],
        must: [{ multi_match: { query, fields: ['recipient', 'subject', 'body'] } }],
      },
    },
    sort: [{ _score: { order: 'desc' } }],
  });

  return response.hits.hits.map((hit: any) => hit._source);
};

export const getSearchClient = () => client;
export const getSearchIndex = () => index;
