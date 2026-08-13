// Consolidated connection pools to avoid SQL Server socket/resource leaks.
// This redirects database operations to use the unified pool in connection.js.
const { pool, poolConnect, sql } = require('./connection');

module.exports = { pool, poolConnect, sql };
