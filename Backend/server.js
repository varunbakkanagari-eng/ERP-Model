const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Import the database connection elements from connection.js
const { pool, poolConnect } = require('./connection');
const { authenticateToken, restrictGuestWrite } = require('./authMiddleware');

const app = express();
const PORT = process.env.PORT || 5000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:3000';

app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }));
app.use(express.json());

// Routes
app.use('/api/payment',        require('./routes/payment'));

// Protected Routes (Require JWT Token and view-only permissions for Guest)
app.use('/api/stock',          authenticateToken, restrictGuestWrite, require('./routes/stock'));
app.use('/api/customers',      authenticateToken, restrictGuestWrite, require('./routes/customers'));
app.use('/api/invoices',       authenticateToken, restrictGuestWrite, require('./routes/invoices'));
app.use('/api/payments',       authenticateToken, restrictGuestWrite, require('./routes/payments'));
app.use('/api/dashboard',      authenticateToken, require('./routes/dashboard'));
app.use('/api/company-stock',  authenticateToken, restrictGuestWrite, require('./routes/companyStock'));

app.get('/api/health', (req, res) =>
  res.json({ status: 'ok', app: 'Sai Varun ERP', time: new Date() })
);

// Database Migration & Seeding Hook on Startup
async function runMigrations() {
  try {
    await poolConnect;
    console.log("🛠️ Running database updates/migrations...");

    // 1. Alter Users table to add IsPaid column if it does not exist
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='Users' AND COLUMN_NAME='IsPaid')
      BEGIN
          ALTER TABLE dbo.Users ADD IsPaid BIT NOT NULL DEFAULT 0;
          PRINT 'Added IsPaid column to Users table.';
      END
    `);

    // 2. Alter Customers table to add Email column if it does not exist
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='Customers' AND COLUMN_NAME='Email')
      BEGIN
          ALTER TABLE dbo.Customers ADD Email NVARCHAR(200) NULL;
          PRINT 'Added Email column to Customers table.';
      END
    `);

    // 2. Seed a default ADMIN and regular user if the Users table is empty
    const checkUsers = await pool.request().query('SELECT COUNT(*) AS count FROM dbo.Users');
    if (checkUsers.recordset[0].count === 0) {
      console.log("🌱 Seeding default users...");
      const salt = await bcrypt.genSalt(10);
      const adminHash = await bcrypt.hash('Indr@1226', salt);
      const userHash = await bcrypt.hash('Password@123', salt);

      // Create Admin
      await pool.request()
        .input('hash', adminHash)
        .query(`
          INSERT INTO dbo.Users (Username, PasswordHash, FullName, Role, IsActive, IsPaid, CreatedAt)
          VALUES ('IndraReddy', @hash, 'System Administrator', 'ADMIN', 1, 1, SYSDATETIME())
        `);

      // Create Standard User
      await pool.request()
        .input('hash', userHash)
        .query(`
          INSERT INTO dbo.Users (Username, PasswordHash, FullName, Role, IsActive, IsPaid, CreatedAt)
          VALUES ('user1', @hash, 'Standard User One', 'USER', 1, 0, SYSDATETIME())
        `);

      console.log("✅ Seeded default users: 'IndraReddy' (Admin, Paid) and 'user1' (User, Unpaid)");
    }
  } catch (err) {
    console.error('❌ Database migration error:', err.message);
  }
}

// Wait for database connection and migrations before listening to port
if (require.main === module && process.env.NODE_ENV !== 'production') {
  poolConnect
    .then(async () => {
      await runMigrations();
      app.listen(PORT, () => {
        console.log(`🚀 Sai Varun ERP API running on http://localhost:${PORT}`);
      });
    })
    .catch((err) => {
      console.error('❌ Server startup blocked: SQL Database connection failure.', err.message);
    });
} else {
  // Await migrations in the background when running serverless
  runMigrations();
}

module.exports = app;
