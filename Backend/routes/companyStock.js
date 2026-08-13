const express = require('express');
const router  = express.Router();
const { pool, poolConnect, sql } = require('../connection');

// ─────────────────────────────────────────────────────────────
//  MATERIAL TYPES
// ─────────────────────────────────────────────────────────────

// GET /api/company-stock/materials
router.get('/materials', async (req, res) => {
  try {
    await poolConnect;
    const result = await pool.request().query(`
      SELECT m.MaterialID, m.Name, m.Unit, m.LowStockAlert, m.Notes, m.IsActive,
             ISNULL(cs.Quantity, 0) AS Quantity
      FROM   MaterialTypes m
      LEFT JOIN CompanyStock cs ON m.MaterialID = cs.MaterialID
      WHERE  m.IsActive = 1
      ORDER  BY m.Name
    `);
    res.json({ data: result.recordset });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST /api/company-stock/materials
router.post('/materials', async (req, res) => {
  const { name, unit, lowStockAlert, notes } = req.body;
  if (!name) return res.status(400).json({ message: 'Material name required' });
  try {
    await poolConnect;
    const r = pool.request();
    r.input('name',  sql.NVarChar(200), name);
    r.input('unit',  sql.NVarChar(50),  unit || 'Bag');
    r.input('alert', sql.Decimal(12,2), lowStockAlert || 50);
    r.input('notes', sql.NVarChar(500), notes || null);
    const result = await r.query(`
      INSERT INTO MaterialTypes (Name, Unit, LowStockAlert, Notes)
      OUTPUT INSERTED.MaterialID
      VALUES (@name, @unit, @alert, @notes);
    `);
    const mid = result.recordset[0].MaterialID;
    await pool.request().input('mid', sql.Int, mid)
      .query('INSERT INTO CompanyStock (MaterialID, Quantity) VALUES (@mid, 0)');
    res.status(201).json({ message: 'Material created', materialID: mid });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// PUT /api/company-stock/materials/:id
router.put('/materials/:id', async (req, res) => {
  const { name, unit, lowStockAlert, notes } = req.body;
  try {
    await poolConnect;
    const r = pool.request();
    r.input('id',    sql.Int,           req.params.id);
    r.input('name',  sql.NVarChar(200), name);
    r.input('unit',  sql.NVarChar(50),  unit);
    r.input('alert', sql.Decimal(12,2), lowStockAlert || 50);
    r.input('notes', sql.NVarChar(500), notes || null);
    await r.query(`
      UPDATE MaterialTypes
      SET Name=@name, Unit=@unit, LowStockAlert=@alert, Notes=@notes
      WHERE MaterialID=@id
    `);
    res.json({ message: 'Updated' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// DELETE /api/company-stock/materials/:id
router.delete('/materials/:id', async (req, res) => {
  try {
    await poolConnect;
    await pool.request().input('id', sql.Int, req.params.id)
      .query('UPDATE MaterialTypes SET IsActive=0 WHERE MaterialID=@id');
    res.json({ message: 'Material removed' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ─────────────────────────────────────────────────────────────
//  SUPPLIERS
// ─────────────────────────────────────────────────────────────

// GET /api/company-stock/suppliers
router.get('/suppliers', async (req, res) => {
  try {
    await poolConnect;
    const result = await pool.request().query(`
      SELECT s.SupplierID, s.Name, s.Phone, s.Address, s.Email, s.CreatedAt,
             ISNULL(SUM(po.TotalAmount), 0) AS TotalPurchased,
             ISNULL(SUM(po.PaidAmount),  0) AS TotalPaid,
             ISNULL(SUM(po.TotalAmount - po.PaidAmount), 0) AS TotalDue
      FROM   Suppliers s
      LEFT JOIN PurchaseOrders po ON s.SupplierID = po.SupplierID
      GROUP BY s.SupplierID, s.Name, s.Phone, s.Address, s.Email, s.CreatedAt
      ORDER BY s.Name
    `);
    res.json({ data: result.recordset });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST /api/company-stock/suppliers
router.post('/suppliers', async (req, res) => {
  const { name, phone, address, email } = req.body;
  if (!name) return res.status(400).json({ message: 'Supplier name required' });
  try {
    await poolConnect;
    const r = pool.request();
    r.input('name',    sql.NVarChar(200), name);
    r.input('phone',   sql.NVarChar(20),  phone || null);
    r.input('address', sql.NVarChar(500), address || null);
    r.input('email',   sql.NVarChar(200), email || null);
    const result = await r.query(`
      INSERT INTO Suppliers (Name, Phone, Address, Email)
      OUTPUT INSERTED.SupplierID
      VALUES (@name, @phone, @address, @email)
    `);
    res.status(201).json({ message: 'Supplier created', supplierID: result.recordset[0].SupplierID });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// PUT /api/company-stock/suppliers/:id
router.put('/suppliers/:id', async (req, res) => {
  const { name, phone, address, email } = req.body;
  try {
    await poolConnect;
    const r = pool.request();
    r.input('id',      sql.Int,           req.params.id);
    r.input('name',    sql.NVarChar(200), name);
    r.input('phone',   sql.NVarChar(20),  phone || null);
    r.input('address', sql.NVarChar(500), address || null);
    r.input('email',   sql.NVarChar(200), email || null);
    await r.query(`
      UPDATE Suppliers SET Name=@name, Phone=@phone, Address=@address, Email=@email
      WHERE SupplierID=@id
    `);
    res.json({ message: 'Updated' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// DELETE /api/company-stock/suppliers/:id
router.delete('/suppliers/:id', async (req, res) => {
  try {
    await poolConnect;
    await pool.request().input('id', sql.Int, req.params.id)
      .query('DELETE FROM Suppliers WHERE SupplierID=@id');
    res.json({ message: 'Supplier deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ─────────────────────────────────────────────────────────────
//  PURCHASE ORDERS (STOCK PURCHASES)
// ─────────────────────────────────────────────────────────────

// GET /api/company-stock/purchases
router.get('/purchases', async (req, res) => {
  try {
    await poolConnect;
    const result = await pool.request().query(`
      SELECT po.POID, po.PONumber, po.PurchaseDate, po.PaymentStatus,
             po.TotalAmount, po.PaidAmount,
             po.TotalAmount - po.PaidAmount AS DueAmount,
             po.IsCreditBuy, po.Notes, po.CreatedAt,
             po.SupplierID, ISNULL(s.Name, po.SupplierName) AS SupplierName,
             COUNT(pol.POLineID) AS LineCount
      FROM   PurchaseOrders po
      LEFT JOIN Suppliers s        ON po.SupplierID = s.SupplierID
      LEFT JOIN PurchaseOrderLines pol ON po.POID = pol.POID
      GROUP BY po.POID, po.PONumber, po.PurchaseDate, po.PaymentStatus,
               po.TotalAmount, po.PaidAmount, po.IsCreditBuy, po.Notes, po.CreatedAt,
               po.SupplierID, s.Name, po.SupplierName
      ORDER BY po.PurchaseDate DESC, po.POID DESC
    `);
    res.json({ data: result.recordset });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/company-stock/purchases/:id
router.get('/purchases/:id', async (req, res) => {
  try {
    await poolConnect;
    const poRes = await pool.request()
      .input('id', sql.Int, req.params.id)
      .query(`
        SELECT po.*, ISNULL(s.Name, po.SupplierName) AS SupplierDisplayName, s.Phone AS SupplierPhone
        FROM   PurchaseOrders po
        LEFT JOIN Suppliers s ON po.SupplierID = s.SupplierID
        WHERE  po.POID = @id
      `);
    if (!poRes.recordset.length) return res.status(404).json({ message: 'Not found' });

    const linesRes = await pool.request()
      .input('id', sql.Int, req.params.id)
      .query(`
        SELECT pol.*, m.Name AS MaterialName, m.Unit
        FROM   PurchaseOrderLines pol
        JOIN   MaterialTypes m ON pol.MaterialID = m.MaterialID
        WHERE  pol.POID = @id
      `);

    const paymentsRes = await pool.request()
      .input('id', sql.Int, req.params.id)
      .query(`
        SELECT sp.*, ISNULL(s.Name,'') AS SupplierName
        FROM   SupplierPayments sp
        LEFT JOIN Suppliers s ON sp.SupplierID = s.SupplierID
        WHERE  sp.POID = @id
        ORDER BY sp.PaymentDate DESC
      `);

    const po = poRes.recordset[0];
    po.lines    = linesRes.recordset;
    po.payments = paymentsRes.recordset;
    res.json({ data: po });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST /api/company-stock/purchases
router.post('/purchases', async (req, res) => {
  const { supplierID, supplierName, purchaseDate, lines, notes, isCreditBuy } = req.body;
  if (!lines || !lines.length)
    return res.status(400).json({ message: 'At least one material line required' });

  const transaction = pool.transaction();
  try {
    await poolConnect;
    await transaction.begin();

    const dateStr = new Date(purchaseDate || Date.now())
      .toISOString().slice(0, 10).replace(/-/g, '');
    const cntRes = await transaction.request().query(`
      SELECT COUNT(*) AS cnt FROM PurchaseOrders
      WHERE CONVERT(date, PurchaseDate) = CONVERT(date, GETDATE())
    `);
    const seq = String(cntRes.recordset[0].cnt + 1).padStart(4, '0');
    const poNumber = `PO-${dateStr}-${seq}`;

    const total = lines.reduce((a, l) => a + l.quantity * l.unitPrice, 0);

    const poR = transaction.request();
    poR.input('poNum',    sql.NVarChar(50),   poNumber);
    poR.input('supID',    sql.Int,            supplierID || null);
    poR.input('supName',  sql.NVarChar(200),  supplierName || null);
    poR.input('date',     sql.Date,           new Date(purchaseDate));
    poR.input('total',    sql.Decimal(12,2),  total);
    poR.input('credit',   sql.Bit,            isCreditBuy ? 1 : 0);
    poR.input('notes',    sql.NVarChar(1000), notes || null);
    const poRes = await poR.query(`
      INSERT INTO PurchaseOrders
        (PONumber, SupplierID, SupplierName, PurchaseDate, TotalAmount, IsCreditBuy, Notes)
      OUTPUT INSERTED.POID
      VALUES (@poNum, @supID, @supName, @date, @total, @credit, @notes)
    `);
    const poID = poRes.recordset[0].POID;

    for (const l of lines) {
      const lr = transaction.request();
      lr.input('poID',  sql.Int,           poID);
      lr.input('matID', sql.Int,           l.materialID);
      lr.input('qty',   sql.Decimal(12,2), l.quantity);
      lr.input('price', sql.Decimal(10,2), l.unitPrice);
      lr.input('amt',   sql.Decimal(12,2), l.quantity * l.unitPrice);
      await lr.query(`
        INSERT INTO PurchaseOrderLines (POID, MaterialID, Quantity, UnitPrice, LineAmount)
        VALUES (@poID, @matID, @qty, @price, @amt);

        MERGE CompanyStock AS target
        USING (SELECT @matID AS MaterialID) AS src ON target.MaterialID = src.MaterialID
        WHEN MATCHED     THEN UPDATE SET Quantity = target.Quantity + @qty
        WHEN NOT MATCHED THEN INSERT (MaterialID, Quantity) VALUES (@matID, @qty);

        INSERT INTO CompanyStockTransactions
          (MaterialID, POID, ChangeType, Quantity, Note, TransactionDate)
        VALUES (@matID, @poID, 'IN', @qty, 'Purchase ' + CAST(@poID AS VARCHAR(10)), GETDATE());
      `);
    }

    await transaction.commit();
    res.status(201).json({ data: { poID, poNumber } });
  } catch (err) {
    await transaction.rollback();
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/company-stock/purchases/:id
router.put('/purchases/:id', async (req, res) => {
  const { supplierID, supplierName, purchaseDate, notes, isCreditBuy } = req.body;
  try {
    await poolConnect;
    const r = pool.request();
    r.input('id',      sql.Int,            req.params.id);
    r.input('supID',   sql.Int,            supplierID || null);
    r.input('supName', sql.NVarChar(200),  supplierName || null);
    r.input('date',    sql.Date,           new Date(purchaseDate));
    r.input('notes',   sql.NVarChar(1000), notes || null);
    r.input('credit',  sql.Bit,            isCreditBuy ? 1 : 0);
    await r.query(`
      UPDATE PurchaseOrders
      SET SupplierID=@supID, SupplierName=@supName, PurchaseDate=@date,
          Notes=@notes, IsCreditBuy=@credit
      WHERE POID=@id
    `);
    res.json({ message: 'Purchase order updated' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// DELETE /api/company-stock/purchases/:id
router.delete('/purchases/:id', async (req, res) => {
  const transaction = pool.transaction();
  try {
    await poolConnect;
    await transaction.begin();

    const lines = await transaction.request()
      .input('id', sql.Int, req.params.id)
      .query('SELECT MaterialID, Quantity FROM PurchaseOrderLines WHERE POID=@id');

    for (const l of lines.recordset) {
      const r = transaction.request();
      r.input('matID', sql.Int,           l.MaterialID);
      r.input('qty',   sql.Decimal(12,2), l.Quantity);
      await r.query('UPDATE CompanyStock SET Quantity = Quantity - @qty WHERE MaterialID=@matID');
    }

    await transaction.request().input('id', sql.Int, req.params.id).query('DELETE FROM SupplierPayments WHERE POID=@id');
    await transaction.request().input('id', sql.Int, req.params.id).query('DELETE FROM PurchaseOrderLines WHERE POID=@id');
    await transaction.request().input('id', sql.Int, req.params.id).query('DELETE FROM CompanyStockTransactions WHERE POID=@id');
    await transaction.request().input('id', sql.Int, req.params.id).query('DELETE FROM PurchaseOrders WHERE POID=@id');

    await transaction.commit();
    res.json({ message: 'Purchase order deleted' });
  } catch (err) {
    await transaction.rollback();
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
//  SUPPLIER PAYMENTS (WITH OVERPAYMENT ENGINE GUARDS)
// ─────────────────────────────────────────────────────────────

// GET /api/company-stock/supplier-payments
router.get('/supplier-payments', async (req, res) => {
  const { poId } = req.query;
  try {
    await poolConnect;
    const r = pool.request();
    let q = `
      SELECT sp.PaymentID, sp.POID, sp.SupplierID, sp.Amount, sp.PaymentMode, sp.Reference, sp.Notes, sp.PaymentDate,
             po.PONumber, ISNULL(s.Name, po.SupplierName) AS SupplierName
      FROM   SupplierPayments sp
      JOIN   PurchaseOrders po ON sp.POID = po.POID
      LEFT JOIN Suppliers s   ON sp.SupplierID = s.SupplierID
    `;
    if (poId) { r.input('poId', sql.Int, poId); q += ' WHERE sp.POID=@poId'; }
    q += ' ORDER BY sp.PaymentDate DESC, sp.PaymentID DESC';
    const result = await r.query(q);
    res.json({ data: result.recordset });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST /api/company-stock/supplier-payments
router.post('/supplier-payments', async (req, res) => {
  const { poID, supplierID, amount, paymentMode, reference, notes } = req.body;
  if (!poID || !amount || parseFloat(amount) <= 0) {
    return res.status(400).json({ message: 'PO and valid amount greater than 0 are required' });
  }

  const transaction = pool.transaction();
  try {
    await poolConnect;
    await transaction.begin();

    // 1. Fetch current financial snapshot of the Purchase Order
    const poCheck = await transaction.request()
      .input('poID', sql.Int, poID)
      .query(`
        SELECT TotalAmount, 
               ISNULL((SELECT SUM(Amount) FROM SupplierPayments WHERE POID = @poID), 0) AS TotalPaid
        FROM PurchaseOrders 
        WHERE POID = @poID
      `);

    if (poCheck.recordset.length === 0) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Purchase Order not found' });
    }

    const { TotalAmount, TotalPaid } = poCheck.recordset[0];
    const remainingBalance = TotalAmount - TotalPaid;

    // 2. Overpayment Active Guard implementation
    if (remainingBalance <= 0) {
      await transaction.rollback();
      return res.status(400).json({ message: 'This Purchase Order is already FULLY PAID.' });
    }

    if (parseFloat(amount) > remainingBalance) {
      await transaction.rollback();
      return res.status(400).json({ 
        message: `Overpayment blocked. Outstanding PO balance is ₹${remainingBalance.toFixed(2)}, but you attempted to pay ₹${parseFloat(amount).toFixed(2)}.` 
      });
    }

    // 3. Insert confirmed payment record
    const r = transaction.request();
    r.input('poID',   sql.Int,            poID);
    r.input('supID',  sql.Int,            supplierID || null);
    r.input('amount', sql.Decimal(12,2),  amount);
    r.input('mode',   sql.NVarChar(20),   paymentMode || 'CASH');
    r.input('ref',    sql.NVarChar(200),  reference || null);
    r.input('notes',  sql.NVarChar(500),  notes || null);
    
    const result = await r.query(`
      INSERT INTO SupplierPayments (POID, SupplierID, Amount, PaymentMode, Reference, Notes)
      OUTPUT INSERTED.PaymentID
      VALUES (@poID, @supID, @amount, @mode, @ref, @notes)
    `);

    // 4. Synchronize state indicators back to parent Purchase Order record
    await transaction.request().input('poID', sql.Int, poID).query(`
      UPDATE PurchaseOrders
      SET PaidAmount = (SELECT ISNULL(SUM(Amount),0) FROM SupplierPayments WHERE POID=@poID),
          PaymentStatus = CASE
            WHEN TotalAmount <= (SELECT ISNULL(SUM(Amount),0) FROM SupplierPayments WHERE POID=@poID) THEN 'PAID'
            WHEN (SELECT ISNULL(SUM(Amount),0) FROM SupplierPayments WHERE POID=@poID) > 0 THEN 'PARTIAL'
            ELSE 'UNPAID'
          END
      WHERE POID=@poID
    `);

    await transaction.commit();
    res.status(201).json({ message: 'Payment recorded securely', paymentID: result.recordset[0].PaymentID });
  } catch (err) {
    await transaction.rollback();
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/company-stock/supplier-payments/:id
router.put('/supplier-payments/:id', async (req, res) => {
  const { amount, paymentMode, reference, notes } = req.body;
  if (!amount || parseFloat(amount) <= 0) {
    return res.status(400).json({ message: 'Valid amount greater than 0 required' });
  }

  const transaction = pool.transaction();
  try {
    await poolConnect;
    await transaction.begin();

    const pRes = await pool.request().input('id', sql.Int, req.params.id)
      .query('SELECT POID, Amount FROM SupplierPayments WHERE PaymentID=@id');
    if (!pRes.recordset.length) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Payment record not found' });
    }
    const { POID, Amount: oldAmount } = pRes.recordset[0];

    const poCheck = await transaction.request()
      .input('poID', sql.Int, POID)
      .query(`
        SELECT TotalAmount, 
               ISNULL((SELECT SUM(Amount) FROM SupplierPayments WHERE POID = @poID), 0) AS TotalPaid
        FROM PurchaseOrders 
        WHERE POID = @poID
      `);

    const { TotalAmount, TotalPaid } = poCheck.recordset[0];
    const balanceWithoutCurrentTxn = TotalAmount - (TotalPaid - oldAmount);

    if (parseFloat(amount) > balanceWithoutCurrentTxn) {
      await transaction.rollback();
      return res.status(400).json({
        message: `Adjustment rejected. Max permissible amount is ₹${balanceWithoutCurrentTxn.toFixed(2)} to avoid overpaying PO.`
      });
    }

    const r = transaction.request();
    r.input('id',     sql.Int,            req.params.id);
    r.input('amount', sql.Decimal(12,2),  amount);
    r.input('mode',   sql.NVarChar(20),   paymentMode || 'CASH');
    r.input('ref',    sql.NVarChar(200),  reference || null);
    r.input('notes',  sql.NVarChar(500),  notes || null);
    
    await r.query(`
      UPDATE SupplierPayments
      SET Amount=@amount, PaymentMode=@mode, Reference=@ref, Notes=@notes
      WHERE PaymentID=@id
    `);

    await transaction.request().input('poID', sql.Int, POID).query(`
      UPDATE PurchaseOrders
      SET PaidAmount = (SELECT ISNULL(SUM(Amount),0) FROM SupplierPayments WHERE POID=@poID),
          PaymentStatus = CASE
            WHEN TotalAmount <= (SELECT ISNULL(SUM(Amount),0) FROM SupplierPayments WHERE POID=@poID) THEN 'PAID'
            WHEN (SELECT ISNULL(SUM(Amount),0) FROM SupplierPayments WHERE POID=@poID) > 0 THEN 'PARTIAL'
            ELSE 'UNPAID'
          END
      WHERE POID=@poID
    `);

    await transaction.commit();
    res.json({ message: 'Payment record altered cleanly' });
  } catch (err) {
    await transaction.rollback();
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/company-stock/supplier-payments/:id
router.delete('/supplier-payments/:id', async (req, res) => {
  const transaction = pool.transaction();
  try {
    await poolConnect;
    await transaction.begin();

    const pRes = await pool.request().input('id', sql.Int, req.params.id)
      .query('SELECT POID FROM SupplierPayments WHERE PaymentID=@id');
    if (!pRes.recordset.length) return res.status(404).json({ message: 'Payment not found' });
    const { POID } = pRes.recordset[0];

    await transaction.request().input('id', sql.Int, req.params.id).query('DELETE FROM SupplierPayments WHERE PaymentID=@id');

    await transaction.request().input('poID', sql.Int, POID).query(`
      UPDATE PurchaseOrders
      SET PaidAmount = (SELECT ISNULL(SUM(Amount),0) FROM SupplierPayments WHERE POID=@poID),
          PaymentStatus = CASE
            WHEN TotalAmount <= (SELECT ISNULL(SUM(Amount),0) FROM SupplierPayments WHERE POID=@poID) THEN 'PAID'
            WHEN (SELECT ISNULL(SUM(Amount),0) FROM SupplierPayments WHERE POID=@poID) > 0 THEN 'PARTIAL'
            ELSE 'UNPAID'
          END
      WHERE POID=@poID
    `);

    await transaction.commit();
    res.json({ message: 'Payment deleted' });
  } catch (err) {
    await transaction.rollback();
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
//  STOCK USAGE & ADJUSTMENTS
// ─────────────────────────────────────────────────────────────

// POST /api/company-stock/use
router.post('/use', async (req, res) => {
  const { materialID, quantity, note } = req.body;
  if (!materialID || !quantity || quantity <= 0)
    return res.status(400).json({ message: 'Material and quantity required' });
  try {
    await poolConnect;
    const r = pool.request();
    r.input('matID', sql.Int,           materialID);
    r.input('qty',   sql.Decimal(12,2), quantity);
    r.input('note',  sql.NVarChar(500), note || 'Used in production');
    await r.query(`
      UPDATE CompanyStock SET Quantity = Quantity - @qty WHERE MaterialID=@matID;
      INSERT INTO CompanyStockTransactions
        (MaterialID, ChangeType, Quantity, Note, TransactionDate)
      VALUES (@matID, 'OUT', @qty, @note, GETDATE());
    `);
    res.json({ message: 'Stock deducted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST /api/company-stock/adjust
router.post('/adjust', async (req, res) => {
  const { materialID, quantity, note } = req.body;
  if (!materialID)
    return res.status(400).json({ message: 'Material required' });
  try {
    await poolConnect;
    const r = pool.request();
    r.input('matID', sql.Int,           materialID);
    r.input('qty',   sql.Decimal(12,2), quantity);
    r.input('note',  sql.NVarChar(500), note || 'Manual adjustment');
    await r.query(`
      MERGE CompanyStock AS target
      USING (SELECT @matID AS MaterialID) AS src ON target.MaterialID = src.MaterialID
      WHEN MATCHED     THEN UPDATE SET Quantity = @qty
      WHEN NOT MATCHED THEN INSERT (MaterialID, Quantity) VALUES (@matID, @qty);

      INSERT INTO CompanyStockTransactions
        (MaterialID, ChangeType, Quantity, Note, TransactionDate)
      VALUES (@matID, 'ADJUST', @qty, @note, GETDATE());
    `);
    res.json({ message: 'Adjusted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// GET /api/company-stock/transactions/:materialId
router.get('/transactions/:materialId', async (req, res) => {
  try {
    await poolConnect;
    const result = await pool.request()
      .input('id', sql.Int, req.params.materialId)
      .query(`
        SELECT TOP 100 cst.TxnID, cst.MaterialID, cst.POID, cst.ChangeType, cst.Quantity, cst.Note, cst.TransactionDate, po.PONumber
        FROM   CompanyStockTransactions cst
        LEFT JOIN PurchaseOrders po ON cst.POID = po.POID
        WHERE  cst.MaterialID=@id
        ORDER  BY cst.TransactionDate DESC
      `);
    res.json({ data: result.recordset });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ─────────────────────────────────────────────────────────────
//  SUMMARY
// ─────────────────────────────────────────────────────────────

// GET /api/company-stock/summary
router.get('/summary', async (req, res) => {
  try {
    await poolConnect;
    const [matRes, finRes] = await Promise.all([
      pool.request().query(`
        SELECT m.MaterialID, m.Name, m.Unit, m.LowStockAlert,
               ISNULL(cs.Quantity, 0) AS Quantity
        FROM   MaterialTypes m
        LEFT JOIN CompanyStock cs ON m.MaterialID = cs.MaterialID
        WHERE  m.IsActive=1
      `),
      pool.request().query(`
        SELECT
          ISNULL(SUM(TotalAmount), 0) AS TotalPurchased,
          ISNULL(SUM(PaidAmount),  0) AS TotalPaid,
          ISNULL(SUM(TotalAmount - PaidAmount), 0) AS TotalDue,
          SUM(CASE WHEN IsCreditBuy=1 THEN TotalAmount ELSE 0 END) AS TotalCreditBought,
          SUM(CASE WHEN PaymentStatus='UNPAID' THEN 1 ELSE 0 END)  AS UnpaidPOs,
          SUM(CASE WHEN PaymentStatus='PARTIAL' THEN 1 ELSE 0 END) AS PartialPOs
        FROM PurchaseOrders
      `),
    ]);
    res.json({ data: { materials: matRes.recordset, finance: finRes.recordset[0] } });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;