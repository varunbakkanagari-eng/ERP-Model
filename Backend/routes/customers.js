const express = require('express');
const router = express.Router();
const { pool, poolConnect, sql } = require('../connection');

// GET /api/customers
router.get('/', async (req, res) => {
  try {
    await poolConnect;
    // FIXED: Subqueries prevent row duplication, ensuring accurate mathematical sums
    const result = await pool.request().query(`
      SELECT 
        c.CustomerID, c.FullName, c.Phone, c.Address, c.Email, c.CreatedAt,
        ISNULL(inv.TotalInvoiced, 0) AS TotalInvoiced,
        ISNULL(pay.TotalPaid, 0)     AS TotalPaid,
        (ISNULL(inv.TotalInvoiced, 0) - ISNULL(pay.TotalPaid, 0)) AS Balance
      FROM Customers c
      LEFT JOIN (
        SELECT CustomerID, SUM(TotalAmount) AS TotalInvoiced
        FROM Invoices
        WHERE Status != 'CANCELLED'
        GROUP BY CustomerID
      ) inv ON c.CustomerID = inv.CustomerID
      LEFT JOIN (
        SELECT CustomerID, SUM(Amount) AS TotalPaid
        FROM Payments
        GROUP BY CustomerID
      ) pay ON c.CustomerID = pay.CustomerID
      ORDER BY c.FullName
    `);
    res.json({ data: result.recordset });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/customers/:id
router.get('/:id', async (req, res) => {
  try {
    await poolConnect;
    // FIXED: Individual customer subqueries prevent balance skewing when multiple payments/invoices exist
    const result = await pool.request()
      .input('id', sql.Int, req.params.id)
      .query(`
        SELECT 
          c.CustomerID, c.FullName, c.Phone, c.Address, c.Email, c.CreatedAt,
          ISNULL(inv.TotalInvoiced, 0) AS TotalInvoiced,
          ISNULL(pay.TotalPaid, 0)     AS TotalPaid,
          (ISNULL(inv.TotalInvoiced, 0) - ISNULL(pay.TotalPaid, 0)) AS Balance
        FROM Customers c
        LEFT JOIN (
          SELECT CustomerID, SUM(TotalAmount) AS TotalInvoiced
          FROM Invoices
          WHERE Status != 'CANCELLED'
          GROUP BY CustomerID
        ) inv ON c.CustomerID = inv.CustomerID
        LEFT JOIN (
          SELECT CustomerID, SUM(Amount) AS TotalPaid
          FROM Payments
          GROUP BY CustomerID
        ) pay ON c.CustomerID = pay.CustomerID
        WHERE c.CustomerID = @id
      `);
    if (!result.recordset.length) return res.status(404).json({ message: 'Customer not found' });
    res.json({ data: result.recordset[0] });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/customers
router.post('/', async (req, res) => {
  const { fullName, phone, address, email } = req.body;
  if (!fullName || !phone) return res.status(400).json({ message: 'Name and phone required' });
  try {
    await poolConnect;
    const r = pool.request();
    r.input('name',    sql.NVarChar(200), fullName);
    r.input('phone',   sql.NVarChar(20),  phone);
    r.input('address', sql.NVarChar(500), address || null);
    r.input('email',   sql.NVarChar(200), email || null);
    const result = await r.query(`
      INSERT INTO Customers (FullName, Phone, Address, Email, CreatedAt)
      OUTPUT INSERTED.CustomerID
      VALUES (@name, @phone, @address, @email, GETDATE())
    `);
    res.status(201).json({ message: 'Customer created', customerID: result.recordset[0].CustomerID });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/customers/:id
router.put('/:id', async (req, res) => {
  const { fullName, phone, address, email } = req.body;
  try {
    await poolConnect;
    const r = pool.request();
    r.input('id',      sql.Int,           req.params.id);
    r.input('name',    sql.NVarChar(200), fullName);
    r.input('phone',   sql.NVarChar(20),  phone);
    r.input('address', sql.NVarChar(500), address || null);
    r.input('email',   sql.NVarChar(200), email || null);
    await r.query(`
      UPDATE Customers SET FullName=@name, Phone=@phone, Address=@address, Email=@email
      WHERE CustomerID=@id
    `);
    res.json({ message: 'Updated' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/customers/:id
router.delete('/:id', async (req, res) => {
  try {
    await poolConnect;
    await pool.request()
      .input('id', sql.Int, req.params.id)
      .query('DELETE FROM Customers WHERE CustomerID = @id');
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;