const express = require('express');
const router  = express.Router();
const { pool, poolConnect, sql } = require('../connection');

// ─────────────────────────────────────────────────────────────
//  GET ALL INVOICES
// ─────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    await poolConnect;
    const result = await pool.request().query(`
      SELECT i.InvoiceID, i.InvoiceNumber, i.InvoiceDate, i.Status,
             i.Subtotal, i.CGSTAmount, i.SGSTAmount, i.TotalAmount,
             i.CustomerID, c.FullName AS CustomerName, c.Phone AS CustomerPhone,
             COUNT(il.LineID) AS LineCount
      FROM   Invoices i
      JOIN   Customers c  ON i.CustomerID = c.CustomerID
      LEFT JOIN InvoiceLines il ON i.InvoiceID = il.InvoiceID
      GROUP BY i.InvoiceID, i.InvoiceNumber, i.InvoiceDate, i.Status,
                i.Subtotal, i.CGSTAmount, i.SGSTAmount, i.TotalAmount,
                i.CustomerID, c.FullName, c.Phone
      ORDER BY i.InvoiceDate DESC, i.InvoiceID DESC
    `);
    res.json({ data: result.recordset });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ─────────────────────────────────────────────────────────────
//  GET SINGLE INVOICE DETAILS
// ─────────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    await poolConnect;
    const invRes = await pool.request()
      .input('id', sql.Int, req.params.id)
      .query(`
        SELECT i.*, c.FullName AS CustomerName, c.Phone AS CustomerPhone,
               c.Address AS CustomerAddress
        FROM   Invoices i
        JOIN   Customers c ON i.CustomerID = c.CustomerID
        WHERE  i.InvoiceID = @id
      `);
    if (!invRes.recordset.length) return res.status(404).json({ message: 'Not found' });

    const linesRes = await pool.request()
      .input('id', sql.Int, req.params.id)
      .query(`
        SELECT il.LineID AS InvoiceLineID, il.InvoiceID, il.BrickID,
               il.Quantity, il.RatePerBrick, il.LineAmount,
               b.SizeInch, b.SizeMM
        FROM   InvoiceLines il
        JOIN   dbo.BrickSizes b ON il.BrickID = b.BrickID
        WHERE  il.InvoiceID = @id
      `);

    const payRes = await pool.request()
      .input('id', sql.Int, req.params.id)
      .query(`SELECT * FROM Payments WHERE InvoiceID = @id ORDER BY PaymentDate`);

    const inv     = invRes.recordset[0];
    inv.lines     = linesRes.recordset;
    inv.payments  = payRes.recordset;
    res.json({ data: inv });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ─────────────────────────────────────────────────────────────
//  POST /api/invoices (CRITICAL CONCURRENCY FIX)
// ─────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { customerID, invoiceDate, lines, notes } = req.body;
  if (!customerID || !lines || !lines.length)
    return res.status(400).json({ message: 'Customer and at least one item required' });

  const transaction = pool.transaction();
  try {
    await poolConnect;
    await transaction.begin();

    // Generate safe dynamic date format matching local zones
    const dateStr  = new Date(invoiceDate || Date.now()).toISOString().slice(0,10).replace(/-/g,'');
    const prefix   = `SLB-${dateStr}-`; // Matches Sri Laxmi Bricks code layout

    // Fetch the single highest value recorded today to skip over gaps or deletions (parameterized)
    const maxRes   = await transaction.request()
      .input('prefix', sql.NVarChar(50), `${prefix}%`)
      .query(`
        SELECT TOP 1 InvoiceNumber FROM Invoices
        WHERE InvoiceNumber LIKE @prefix
        ORDER BY InvoiceNumber DESC
      `);

    let seq = '0001';
    if (maxRes.recordset && maxRes.recordset.length > 0) {
      const lastInvoiceNumber = maxRes.recordset[0].InvoiceNumber;
      const lastSeqStr = lastInvoiceNumber.replace(prefix, ''); 
      const lastSeqNum = parseInt(lastSeqStr, 10);
      seq = String(lastSeqNum + 1).padStart(4, '0');
    }
    const invoiceNumber = `${prefix}${seq}`;

    let subtotal = 0;
    for (const l of lines) subtotal += l.quantity * l.ratePerBrick;
    const cgstRate = 9, sgstRate = 9;
    const cgst  = parseFloat((subtotal * cgstRate / 100).toFixed(2));
    const sgst  = parseFloat((subtotal * sgstRate / 100).toFixed(2));
    const total = subtotal + cgst + sgst;

    const invR = transaction.request();
    invR.input('custID',   sql.Int,            customerID);
    invR.input('invNum',   sql.NVarChar(50),   invoiceNumber);
    invR.input('invDate',  sql.Date,           new Date(invoiceDate));
    invR.input('subtotal', sql.Decimal(12,2),  subtotal);
    invR.input('cgstRate', sql.Decimal(5,2),   cgstRate);
    invR.input('cgst',     sql.Decimal(12,2),  cgst);
    invR.input('sgstRate', sql.Decimal(5,2),   sgstRate);
    invR.input('sgst',     sql.Decimal(12,2),  sgst);
    invR.input('total',    sql.Decimal(12,2),  total);
    invR.input('notes',    sql.NVarChar(1000), notes || null);
    
    const invRes = await invR.query(`
      INSERT INTO Invoices
        (CustomerID, InvoiceNumber, InvoiceDate, Status, Subtotal,
         CGSTRate, CGSTAmount, SGSTRate, SGSTAmount, TotalAmount, Notes, CreatedAt)
      OUTPUT INSERTED.InvoiceID
      VALUES (@custID, @invNum, @invDate, 'UNPAID', @subtotal,
              @cgstRate, @cgst, @sgstRate, @sgst, @total, @notes, GETDATE())
    `);
    const invoiceID = invRes.recordset[0].InvoiceID;

    for (const l of lines) {
      const lr = transaction.request();
      lr.input('invID',   sql.Int,            invoiceID);
      lr.input('brickID', sql.Int,            l.brickID);
      lr.input('qty',     sql.Int,            l.quantity);
      lr.input('rate',    sql.Decimal(10,2),  l.ratePerBrick);
      lr.input('amt',     sql.Decimal(12,2),  l.quantity * l.ratePerBrick);
      
      await lr.query(`
        INSERT INTO InvoiceLines (InvoiceID, BrickID, Quantity, RatePerBrick, LineAmount)
        VALUES (@invID, @brickID, @qty, @rate, @amt);

        UPDATE Stock SET Quantity = Quantity - @qty WHERE BrickID = @brickID;

        INSERT INTO StockTransactions (BrickID, TxnType, Quantity, Note, TransactionDate)
        VALUES (@brickID, 'OUT', @qty, 'Invoice #' + CAST(@invID AS NVARCHAR), GETDATE());
      `);
    }

    await transaction.commit();
    res.status(201).json({ data: { invoiceID, invoiceNumber } });
  } catch (err) {
    await transaction.rollback();
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
//  PUT /api/invoices/:id
// ─────────────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  const { lines } = req.body;
  const transaction = pool.transaction();
  try {
    await poolConnect;
    await transaction.begin();

    const oldLines = await transaction.request()
      .input('id', sql.Int, req.params.id)
      .query(`SELECT BrickID, Quantity FROM InvoiceLines WHERE InvoiceID = @id`);

    for (const ol of oldLines.recordset) {
      const r = transaction.request();
      r.input('brickID', sql.Int, ol.BrickID);
      r.input('qty',     sql.Int, ol.Quantity);
      await r.query(`UPDATE Stock SET Quantity = Quantity + @qty WHERE BrickID = @brickID`);
    }

    await transaction.request().input('id', sql.Int, req.params.id)
      .query(`DELETE FROM InvoiceLines WHERE InvoiceID = @id`);

    let subtotal = 0;
    for (const l of lines) subtotal += l.quantity * l.ratePerBrick;
    const cgst  = parseFloat((subtotal * 0.09).toFixed(2));
    const sgst  = parseFloat((subtotal * 0.09).toFixed(2));
    const total = subtotal + cgst + sgst;

    for (const l of lines) {
      const lr = transaction.request();
      lr.input('invID',   sql.Int,           req.params.id);
      lr.input('brickID', sql.Int,           l.brickID);
      lr.input('qty',     sql.Int,           l.quantity);
      lr.input('rate',    sql.Decimal(10,2), l.ratePerBrick);
      lr.input('amt',     sql.Decimal(12,2), l.quantity * l.ratePerBrick);
      await lr.query(`
        INSERT INTO InvoiceLines (InvoiceID, BrickID, Quantity, RatePerBrick, LineAmount)
        VALUES (@invID, @brickID, @qty, @rate, @amt);
        UPDATE Stock SET Quantity = Quantity - @qty WHERE BrickID = @brickID;
      `);
    }

    const hr = transaction.request();
    hr.input('id',       sql.Int,           req.params.id);
    hr.input('subtotal', sql.Decimal(12,2), subtotal);
    hr.input('cgst',     sql.Decimal(12,2), cgst);
    hr.input('sgst',     sql.Decimal(12,2), sgst);
    hr.input('total',    sql.Decimal(12,2), total);
    await hr.query(`
      UPDATE Invoices
      SET Subtotal=@subtotal, CGSTAmount=@cgst, SGSTAmount=@sgst, TotalAmount=@total
      WHERE InvoiceID=@id
    `);

    await transaction.commit();
    res.json({ message: 'Invoice updated' });
  } catch (err) {
    await transaction.rollback();
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
//  DELETE /api/invoices/:id
// ─────────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  const restoreStock = req.query.restoreStock === 'true';
  const invoiceId    = req.params.id;

  const transaction = pool.transaction();
  try {
    await poolConnect;
    await transaction.begin();

    const lines = await transaction.request()
      .input('id', sql.Int, invoiceId)
      .query(`SELECT BrickID, Quantity FROM InvoiceLines WHERE InvoiceID = @id`);

    if (restoreStock) {
      for (const l of lines.recordset) {
        const r = transaction.request();
        r.input('brickID', sql.Int, l.BrickID);
        r.input('qty',     sql.Int, l.Quantity);
        r.input('invID',   sql.Int, invoiceId);
        
        await r.query(`
          UPDATE Stock SET Quantity = Quantity + @qty WHERE BrickID = @brickID;

          INSERT INTO StockTransactions (BrickID, TxnType, Quantity, Note, TransactionDate)
          VALUES (@brickID, 'IN', @qty, 'Restored: Inv #' + CAST(@invID AS NVARCHAR), GETDATE());
        `);
      }
    }

    await transaction.request().input('id', sql.Int, invoiceId).query(`DELETE FROM InvoiceLines WHERE InvoiceID = @id`);
    await transaction.request().input('id', sql.Int, invoiceId).query(`DELETE FROM Invoices WHERE InvoiceID = @id`);

    await transaction.commit();
    return res.json({ message: 'Invoice deleted successfully.' });
    
  } catch (err) {
    await transaction.rollback();
    return res.status(500).json({ message: err.message });
  }
});

module.exports = router;
