require('dotenv').config();

const { connectDB } = require('../config/database');
const { User } = require('../models');

const email = process.argv[2] || 'ramizahamed959@gmail.com';
const password = process.argv[3] || 'Admin@123';

const run = async () => {
  await connectDB();

  const admin = await User.findOne({ where: { email } });
  if (!admin) {
    console.error(`Admin user not found for ${email}`);
    process.exit(1);
  }

  await admin.update({
    password,
    isActive: true,
    isApproved: true,
    role: 'admin',
  });

  console.log(`Admin password reset for ${email}`);
  process.exit(0);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
