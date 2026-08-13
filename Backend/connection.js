const sql = require('mssql');
require('dotenv').config();

const config = {
  server:   process.env.DB_HOST || process.env.DB_SERVER,
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port:     parseInt(process.env.DB_PORT) || 1433,
  options: {
    encrypt:                process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true',
    enableArithAbort:       true,
  },
  pool: {
    max: parseInt(process.env.DB_POOL_MAX) || 5,
    min: parseInt(process.env.DB_POOL_MIN) || 0,
    idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_TIMEOUT) || 30000,
    reapIntervalMillis: parseInt(process.env.DB_POOL_REAP_INTERVAL) || 15000,
  },
};

// Diagnostic configuration check
const missingKeys = [];
if (!config.server) missingKeys.push('DB_HOST / DB_SERVER');
if (!config.database) missingKeys.push('DB_NAME');
if (!config.user) missingKeys.push('DB_USER');
if (!config.password) missingKeys.push('DB_PASSWORD');

if (missingKeys.length > 0) {
  console.warn(`⚠️  Warning: Missing database environment variables: ${missingKeys.join(', ')}`);
}

const pool        = new sql.ConnectionPool(config);
const poolConnect = pool.connect();

pool.on('error', (err) => {
  console.error('SQL Pool Error:', err);
});

poolConnect
  .then(() => console.log(`✅ Connected to SQL Server — ${config.server} / ${config.database}`))
  .catch((err) => console.error('❌ SQL Server connection failed:', err.message));

module.exports = { pool, poolConnect, sql };