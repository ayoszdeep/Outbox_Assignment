'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE "SlackConnections"
        ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active',
        ADD COLUMN IF NOT EXISTS last_error TEXT,
        ADD COLUMN IF NOT EXISTS last_error_at TIMESTAMP WITH TIME ZONE;
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE "SlackConnections"
        DROP COLUMN IF EXISTS status,
        DROP COLUMN IF EXISTS last_error,
        DROP COLUMN IF EXISTS last_error_at;
    `);
  },
};
