const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const VendorPayout = sequelize.define('VendorPayout', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  vendor_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'users', key: 'id' },
  },
  reference_code: {
    type: DataTypes.STRING(40),
    allowNull: false,
    unique: true,
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
  },
  status: {
    type: DataTypes.ENUM('requested', 'scheduled', 'paid', 'failed'),
    allowNull: false,
    defaultValue: 'requested',
  },
  order_count: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  requested_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  scheduled_for: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  processed_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'vendor_payouts',
  timestamps: true,
});

module.exports = VendorPayout;
