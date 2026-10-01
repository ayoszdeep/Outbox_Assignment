'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      ALTER TABLE "Senders"
        ADD COLUMN IF NOT EXISTS hourly_limit INTEGER NOT NULL DEFAULT 100;
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE "Senders"
        DROP COLUMN IF EXISTS hourly_limit;
    `);
  },
};
