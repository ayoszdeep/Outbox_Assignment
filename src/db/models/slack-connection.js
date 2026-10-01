'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class SlackConnection extends Model {
    static associate(models) {
      SlackConnection.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
    }
  }

  SlackConnection.init({
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      field: 'user_id',
      references: {
        model: 'Users',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    teamId: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'team_id',
    },
    channelId: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'channel_id',
    },
    accessToken: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'access_token',
    },
    webhookUrl: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'webhook_url',
    },
    connectedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'connected_at',
    },
    // 'active' until Slack rejects the credentials; then 'invalid' so the dashboard
    // can prompt a reconnect. Reconnecting flips it back without a redeploy.
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'active',
      field: 'status',
    },
    lastError: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'last_error',
    },
    lastErrorAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'last_error_at',
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'created_at',
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'updated_at',
    },
  }, {
    sequelize,
    modelName: 'SlackConnection',
    tableName: 'SlackConnections',
    underscored: true,
  });

  return SlackConnection;
};
