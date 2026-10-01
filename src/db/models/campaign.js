'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Campaign extends Model {
    static associate(models) {
      Campaign.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
      Campaign.belongsTo(models.Sender, { foreignKey: 'sender_id', as: 'sender' });
      Campaign.hasMany(models.Email, { foreignKey: 'campaign_id', as: 'emails' });
    }
  }

  Campaign.init({
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'user_id',
      references: {
        model: 'Users',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    senderId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'sender_id',
      references: {
        model: 'Senders',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    subject: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    body: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    startTime: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'start_time',
    },
    delayMs: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'delay_ms',
    },
    hourlyLimit: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'hourly_limit',
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
    modelName: 'Campaign',
    tableName: 'Campaigns',
    underscored: true,
  });

  return Campaign;
};
