'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    static associate(models) {
      User.hasMany(models.Sender, { foreignKey: 'user_id', as: 'senders' });
      User.hasMany(models.Campaign, { foreignKey: 'user_id', as: 'campaigns' });
      User.hasMany(models.Email, { foreignKey: 'user_id', as: 'emails' });
      User.hasOne(models.SlackConnection, { foreignKey: 'user_id', as: 'slackConnection' });
    }
  }

  User.init({
    id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    passwordHash: {
      type: DataTypes.STRING,
      allowNull: true,
      field: 'password_hash',
    },
    googleId: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
      field: 'google_id',
    },
    firebaseUid: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
      field: 'firebase_uid',
    },
    authProvider: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'email',
      field: 'auth_provider',
    },
    avatarUrl: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'avatar_url',
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
    modelName: 'User',
    tableName: 'Users',
    underscored: true,
  });

  return User;
};
