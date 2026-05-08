require('dotenv').config();

const { connectDB } = require('../config/database');
const { User } = require('../models');
const bcrypt = require('bcryptjs');

const email = process.argv[2] || 'ramizahamed959@gmail.com';
const password = process.argv[3] || 'Admin@123';
const name = process.argv[4] || 'Admin User';

const run = async () => {
  await connectDB();

  const existingAdmin = await User.findOne({ where: { email } });
  if (existingAdmin) {
    console.log(`Admin user already exists for ${email}`);
    process.exit(0);
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const admin = await User.create({
    name,
    email,
    password: hashedPassword,
    role: 'admin',
    isActive: true,
    isApproved: true,
  });

  console.log(`Admin user created: ${email}`);
  console.log(`Password: ${password}`);
  process.exit(0);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
