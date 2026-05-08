const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const UserSecurity = sequelize.define('UserSecurity', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true,
  },
  emailVerified: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
  phoneVerified: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
  emailVerificationTokenHash: {
    type: DataTypes.STRING(128),
    allowNull: true,
  },
  emailVerificationExpiresAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  passwordResetTokenHash: {
    type: DataTypes.STRING(128),
    allowNull: true,
  },
  passwordResetExpiresAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'user_security',
  timestamps: true,
});

module.exports = UserSecurity;
