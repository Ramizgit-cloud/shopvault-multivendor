require('dotenv').config();
const { validateEnvironment } = require('./config/validateEnvironment');

validateEnvironment();

const app = require('./app');
const { connectDB } = require('./config/database');

// Must load models before DB sync so associations are registered
require('./models/index');

const PORT = process.env.PORT || 5000;

const ensureDemoUser = async (User, UserSecurity, { name, email, password, role, isApproved = true, isActive = true }) => {
  const [user, created] = await User.findOrCreate({
    where: { email },
    defaults: {
      name,
      email,
      password,
      role,
      isApproved,
      isActive,
    },
  });

  if (!created) {
    await user.update({
      name,
      password,
      role,
      isApproved,
      isActive,
    });
  }

  const [security] = await UserSecurity.findOrCreate({
    where: { user_id: user.id },
    defaults: { emailVerified: true, phoneVerified: true },
  });

  if (!security.emailVerified || !security.phoneVerified) {
    await security.update({ emailVerified: true, phoneVerified: true });
  }

  return user;
};

const startServer = async () => {
  await connectDB();

  const {
    User,
    UserSecurity,
  } = require('./models');

  if (process.env.ENABLE_DEMO_DATA === 'true' && process.env.NODE_ENV !== 'production') {
    await ensureDemoUser(User, UserSecurity, {
      name: 'Super Admin',
      email: 'ramizahamed959@gmail.com',
      password: 'Admin@123',
      role: 'admin',
    });

    await ensureDemoUser(User, UserSecurity, {
      name: 'Legacy Admin',
      email: 'admin@shop.com',
      password: 'Admin@123',
      role: 'admin',
    });

    await ensureDemoUser(User, UserSecurity, {
      name: 'Demo Vendor',
      email: 'vendor@shop.com',
      password: 'Vendor@123',
      role: 'vendor',
    });

    await ensureDemoUser(User, UserSecurity, {
      name: 'Second Vendor',
      email: 'vendor2@shop.com',
      password: 'Vendor@123',
      role: 'vendor',
    });

    await ensureDemoUser(User, UserSecurity, {
      name: 'Demo Customer',
      email: 'customer@shop.com',
      password: 'Customer@123',
      role: 'customer',
    });

    console.log('Demo credentials ensured for local development.');
  }

  const server = app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use. Stop the old process or change PORT in .env.`);
      process.exit(1);
    }

    console.error('Server failed to start:', err);
    process.exit(1);
  });
};

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
