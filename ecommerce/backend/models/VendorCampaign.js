const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const VendorCampaign = sequelize.define('VendorCampaign', {
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
  name: {
    type: DataTypes.STRING(120),
    allowNull: false,
  },
  description: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  campaign_type: {
    type: DataTypes.ENUM('catalog_sale', 'buy_x_get_y'),
    allowNull: false,
    defaultValue: 'catalog_sale',
  },
  target_scope: {
    type: DataTypes.ENUM('all_products', 'category', 'product'),
    allowNull: false,
    defaultValue: 'all_products',
  },
  target_category: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  target_product_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: 'products', key: 'id' },
  },
  discount_percentage: {
    type: DataTypes.DECIMAL(5, 2),
    allowNull: true,
  },
  buy_quantity: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  free_quantity: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  starts_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  expires_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
}, {
  tableName: 'vendor_campaigns',
  timestamps: true,
});

module.exports = VendorCampaign;
