'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      ALTER TABLE "Users"
        ADD COLUMN IF NOT EXISTS firebase_uid VARCHAR(255),
        ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(50) DEFAULT 'email',
        ADD COLUMN IF NOT EXISTS avatar_url TEXT;

      CREATE UNIQUE INDEX IF NOT EXISTS users_firebase_uid_unique
        ON "Users" (firebase_uid)
        WHERE firebase_uid IS NOT NULL;
    `);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS users_firebase_uid_unique;

      ALTER TABLE "Users"
        DROP COLUMN IF EXISTS firebase_uid,
        DROP COLUMN IF EXISTS auth_provider,
        DROP COLUMN IF EXISTS avatar_url;
    `);
  },
};
