const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const OrderTrackingEvent = sequelize.define('OrderTrackingEvent', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  order_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'orders', key: 'id' },
  },
  status: {
    type: DataTypes.ENUM('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'),
    allowNull: false,
  },
  title: {
    type: DataTypes.STRING(120),
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  actor_role: {
    type: DataTypes.ENUM('system', 'customer', 'vendor', 'admin'),
    allowNull: false,
    defaultValue: 'system',
  },
}, {
  tableName: 'order_tracking_events',
  timestamps: true,
  updatedAt: false,
});

module.exports = OrderTrackingEvent;
