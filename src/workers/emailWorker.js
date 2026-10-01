require('ts-node/register');

const { setupScheduledEmailWorker } = require('../processors/scheduled-email.processor');

setupScheduledEmailWorker();