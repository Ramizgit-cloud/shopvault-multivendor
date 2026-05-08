const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    dialect: 'mysql',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  }
);

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log('MySQL connected successfully');

    const shouldSync = process.env.DB_SYNC === 'true';
    if (shouldSync) {
      const alterTables = process.env.DB_SYNC_ALTER === 'true';
      await sequelize.sync(alterTables ? { alter: true } : {});
      console.log(`Database synced${alterTables ? ' with alter' : ''}`);
    } else {
      console.log('Database sync skipped (set DB_SYNC=true to enable)');
    }
  } catch (error) {
    console.error('Database connection failed:', error.message);
    process.exit(1);
  }
};

module.exports = { sequelize, connectDB };
