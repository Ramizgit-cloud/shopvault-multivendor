const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const VendorReview = sequelize.define('VendorReview', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'users', key: 'id' },
  },
  vendor_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'users', key: 'id' },
  },
  rating: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: { min: 1, max: 5 },
  },
  comment: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'vendor_reviews',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['user_id', 'vendor_id'],
    },
  ],
});

module.exports = VendorReview;
