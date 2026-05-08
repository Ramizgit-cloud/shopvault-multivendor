const { sequelize } = require('../config/database');

const tableSchemaCache = new Map();

const getTableSchema = async (tableName) => {
  if (!tableSchemaCache.has(tableName)) {
    tableSchemaCache.set(tableName, sequelize.getQueryInterface().describeTable(tableName));
  }

  try {
    return await tableSchemaCache.get(tableName);
  } catch (error) {
    tableSchemaCache.delete(tableName);
    throw error;
  }
};

const hasTableColumn = async (tableName, columnName) => {
  try {
    const schema = await getTableSchema(tableName);
    return Boolean(schema?.[columnName]);
  } catch {
    return false;
  }
};

const getProductAttributes = async () => {
  const attributes = ['id', 'name', 'description', 'price', 'stock', 'category', 'image', 'vendor_id', 'isActive', 'discount', 'createdAt', 'updatedAt'];
  if (await hasTableColumn('products', 'isTemporarilyUnavailable')) {
    attributes.push('isTemporarilyUnavailable');
  }
  if (await hasTableColumn('products', 'brand')) {
    attributes.push('brand');
  }
  if (await hasTableColumn('products', 'variants')) {
    attributes.push('variants');
  }
  return attributes;
};

const getOrderItemAttributes = async () => {
  const attributes = ['id', 'order_id', 'product_id', 'quantity', 'price', 'vendor_id', 'createdAt', 'updatedAt'];
  if (await hasTableColumn('order_items', 'variant_id')) {
    attributes.push('variant_id');
  }
  if (await hasTableColumn('order_items', 'variant_label')) {
    attributes.push('variant_label');
  }
  return attributes;
};

module.exports = {
  hasTableColumn,
  getProductAttributes,
  getOrderItemAttributes,
};
