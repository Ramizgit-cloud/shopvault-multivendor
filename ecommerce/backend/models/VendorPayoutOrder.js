const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const VendorPayoutOrder = sequelize.define('VendorPayoutOrder', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  payout_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'vendor_payouts', key: 'id' },
  },
  vendor_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'users', key: 'id' },
  },
  order_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'orders', key: 'id' },
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
}, {
  tableName: 'vendor_payout_orders',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['payout_id', 'order_id'],
    },
  ],
});

module.exports = VendorPayoutOrder;
