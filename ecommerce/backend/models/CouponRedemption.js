const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const CouponRedemption = sequelize.define('CouponRedemption', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  coupon_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'coupons', key: 'id' },
  },
  order_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'orders', key: 'id' },
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: 'users', key: 'id' },
  },
  coupon_code: {
    type: DataTypes.STRING(40),
    allowNull: false,
  },
  vendor_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'users', key: 'id' },
  },
  discount_amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  original_total: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  is_consumed: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
}, {
  tableName: 'coupon_redemptions',
  timestamps: true,
});

module.exports = CouponRedemption;
