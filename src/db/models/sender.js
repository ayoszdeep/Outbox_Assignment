'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Sender extends Model {
    static associate(models) {
      Sender.belongsTo(models.User, { foreignKey: 'user_id', as: 'user' });
      Sender.hasMany(models.Campaign, { foreignKey: 'sender_id', as: 'campaigns' });
      Sender.hasMany(models.Email, { foreignKey: 'sender_id', as: 'emails' });
    }
  }

  Sender.init({
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
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    smtpHost: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'smtp_host',
    },
    smtpPort: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'smtp_port',
    },
    smtpUser: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'smtp_user',
    },
    smtpPassword: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: 'smtp_password',
    },
    hourlyLimit: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 100,
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
    modelName: 'Sender',
    tableName: 'Senders',
    underscored: true,
  });

  return Sender;
};
