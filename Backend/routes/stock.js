const express = require('express');
const router  = express.Router();
const { pool, poolConnect, sql } = require('../connection');

// GET /api/stock
router.get('/', async (req, res) => {
  try {
    await poolConnect;
 // Inside routes/stock.js (GET /)
const result = await pool.request().query(`
  SELECT b.BrickID, b.SizeInch, b.SizeMM, b.CostPerBrick, b.TripQty, b.IsActive,
         s.StockID, s.Quantity, s.LowStockAlert, s.LastUpdated
  FROM dbo.BrickSizes b
  LEFT JOIN dbo.Stock s ON b.BrickID = s.BrickID
  WHERE b.IsActive = 1
  ORDER BY b.BrickID
`);
    res.json({ data: result.recordset });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/stock/:id
router.get('/:id', async (req, res) => {
  try {
    await poolConnect;
    const result = await pool.request()
      .input('id', sql.Int, req.params.id)
      .query(`
        SELECT b.BrickID, b.SizeInch, b.SizeMM, b.CostPerBrick, b.TripQty,
               ISNULL(s.LowStockAlert, 500) AS LowStockAlert,
               ISNULL(s.Quantity, 0) AS Quantity
        FROM   dbo.BrickSizes b
        LEFT JOIN dbo.Stock s ON b.BrickID = s.BrickID
        WHERE  b.BrickID = @id
      `);
    if (!result.recordset.length) return res.status(404).json({ message: 'Not found' });
    res.json({ data: result.recordset[0] });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST /api/stock/:id/add
router.post('/:id/add', async (req, res) => {
  const { quantity, note } = req.body;
  if (!quantity || quantity <= 0) return res.status(400).json({ message: 'Invalid quantity' });
  try {
    await poolConnect;
    const r = pool.request();
    r.input('id',   sql.Int,          req.params.id);
    r.input('qty',  sql.Int,          quantity);
    r.input('note', sql.NVarChar(500), note || 'Stock received');
    await r.query(`
      MERGE Stock AS target
      USING (SELECT @id AS BrickID) AS src ON target.BrickID = src.BrickID
      WHEN MATCHED     THEN UPDATE SET Quantity = target.Quantity + @qty
      WHEN NOT MATCHED THEN INSERT (BrickID, Quantity) VALUES (@id, @qty);

      /* FIXED HERE: Changed TxnDate to TransactionDate */
      INSERT INTO StockTransactions (BrickID, TxnType, Quantity, Note, TransactionDate)
      VALUES (@id, 'IN', @qty, @note, GETDATE());
    `);
    res.json({ message: 'Stock added' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// PUT /api/stock/:id/quantity
router.put('/:id/quantity', async (req, res) => {
  const { quantity, note } = req.body;
  try {
    await poolConnect;
    const r = pool.request();
    r.input('id',   sql.Int,          req.params.id);
    r.input('qty',  sql.Int,          quantity);
    r.input('note', sql.NVarChar(500), note || 'Manual adjustment');
    await r.query(`
      MERGE Stock AS target
      USING (SELECT @id AS BrickID) AS src ON target.BrickID = src.BrickID
      WHEN MATCHED     THEN UPDATE SET Quantity = @qty
      WHEN NOT MATCHED THEN INSERT (BrickID, Quantity) VALUES (@id, @qty);

      /* FIXED HERE: Changed TxnDate to TransactionDate */
      INSERT INTO StockTransactions (BrickID, TxnType, Quantity, Note, TransactionDate)
      VALUES (@id, 'ADJUST', @qty, @note, GETDATE());
    `);
    res.json({ message: 'Quantity set' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// PUT /api/stock/:id
router.put('/:id', async (req, res) => {
  const { costPerBrick, tripQty, lowStockAlert } = req.body;
  try {
    await poolConnect;
    const r = pool.request();
    r.input('id',    sql.Int,           req.params.id);
    r.input('cost',  sql.Decimal(10,2), costPerBrick);
    r.input('trip',  sql.Int,           tripQty);
    r.input('alert', sql.Int,           lowStockAlert);
    await r.query(`
      UPDATE dbo.BrickSizes
      SET CostPerBrick=@cost, TripQty=@trip
      WHERE BrickID=@id;

      MERGE dbo.Stock AS target
      USING (SELECT @id AS BrickID) AS src ON target.BrickID = src.BrickID
      WHEN MATCHED THEN UPDATE SET LowStockAlert = @alert
      WHEN NOT MATCHED THEN INSERT (BrickID, Quantity, LowStockAlert) VALUES (@id, 0, @alert);
    `);
    res.json({ message: 'Updated' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/stock/:id/transactions
router.get('/:id/transactions', async (req, res) => {
  try {
    await poolConnect;
    const result = await pool.request()
      .input('id', sql.Int, req.params.id)
      .query(`
        /* FIXED HERE: Changed TxnDate ORDER BY clause to TransactionDate */
        SELECT TOP 50 TxnID, BrickID, TxnType AS ChangeType,
               Quantity, Note, TransactionDate
        FROM   StockTransactions
        WHERE  BrickID = @id
        ORDER  BY TransactionDate DESC
      `);
    res.json({ data: result.recordset });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
