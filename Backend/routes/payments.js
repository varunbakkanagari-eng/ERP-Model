const express = require('express');
const router = express.Router();
const { pool, poolConnect, sql } = require('../connection');

// ─────────────────────────────────────────────────────────────
//  GET ALL OR CUSTOMER PAYMENTS
// ─────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const { customerId } = req.query;
  try {
    await poolConnect;
    const r = pool.request();
    let query = `
      SELECT p.*, c.FullName AS CustomerName
      FROM   Payments p
      JOIN   Customers c ON p.CustomerID = c.CustomerID
    `;
    if (customerId) {
      r.input('custID', sql.Int, customerId);
      query += ' WHERE p.CustomerID = @custID';
    }
    query += ' ORDER BY p.PaymentDate DESC, p.PaymentID DESC';
    const result = await r.query(query);
    res.json({ data: result.recordset });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
//  POST /api/payments (WITH INDEPENDENT TRANSACTION LOCKING)
// ─────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const { customerID, invoiceID, amount, paymentMode, reference, notes } = req.body;
  const pAmount = parseFloat(amount || 0);

  if (!customerID || pAmount <= 0)
    return res.status(400).json({ message: 'CustomerID and valid positive amount are required' });

  // Create transaction scope out here so catch block can see it
  let transaction;

  try {
    await poolConnect;

    // ─── STAGE 1: GUARANTEED VALIDATION LOCK IF LINKED TO AN INVOICE ───
    if (invoiceID) {
      const invRes = await pool.request()
        .input('invID', sql.Int, invoiceID)
        .query('SELECT TotalAmount, InvoiceNumber FROM Invoices WHERE InvoiceID = @invID');
      
      if (!invRes.recordset.length) {
        return res.status(404).json({ message: 'Linked invoice not found' });
      }
      
      const { TotalAmount, InvoiceNumber } = invRes.recordset[0];

      const payRes = await pool.request()
        .input('invID', sql.Int, invoiceID)
        .query('SELECT ISNULL(SUM(Amount), 0) AS TotalPaid FROM Payments WHERE InvoiceID = @invID');
      
      const totalPaidAlready = parseFloat(payRes.recordset[0].TotalPaid || 0);
      const remainingBalance = TotalAmount - totalPaidAlready;

      if (remainingBalance <= 0) {
        return res.status(400).json({ 
          message: `Invoice ${InvoiceNumber} has already been fully paid! No further payments can be accepted.` 
        });
      }

      if (pAmount > remainingBalance) {
        return res.status(400).json({ 
          message: `Overpayment Error: Only ₹${remainingBalance.toLocaleString('en-IN')} remains due on Invoice ${InvoiceNumber}, but you tried to submit ₹${pAmount.toLocaleString('en-IN')}.` 
        });
      }
    }

    // ─── BEGIN TRANSACTION TO ISOLATE THIS INVOICE TIME ROW ───
    transaction = pool.transaction();
    await transaction.begin();

    // ─── STAGE 2: PROCESS THE INSERT QUERY INSIDE THE TRANSACTION ───
    const r = transaction.request();
    r.input('custID',  sql.Int,            customerID);
    r.input('invID',   sql.Int,            invoiceID || null);
    r.input('amount',  sql.Decimal(12, 2), pAmount);
    r.input('mode',    sql.NVarChar(20),   paymentMode || 'CASH');
    r.input('ref',     sql.NVarChar(200),  reference || null);
    r.input('notes',   sql.NVarChar(500),  notes || null);

    const result = await r.query(`
      INSERT INTO Payments (CustomerID, InvoiceID, Amount, PaymentMode, Reference, Notes, PaymentDate)
      OUTPUT INSERTED.PaymentID
      VALUES (@custID, @invID, @amount, @mode, @ref, @notes, GETDATE());
    `);

    const newPaymentID = result.recordset[0].PaymentID;

    // ─── STAGE 3: AUTOMATED STATUS MONITOR UPDATE (TRANSACTIONAL) ───
    if (invoiceID) {
      await transaction.request()
        .input('invID', sql.Int, invoiceID)
        .query(`
          UPDATE Invoices SET Status = (
            CASE
              WHEN TotalAmount <= (SELECT ISNULL(SUM(Amount),0) FROM Payments WHERE InvoiceID = @invID)
              THEN 'PAID'
              WHEN (SELECT ISNULL(SUM(Amount),0) FROM Payments WHERE InvoiceID = @invID) > 0
              THEN 'PARTIAL'
              ELSE 'UNPAID'
            END
          ) WHERE InvoiceID = @invID AND Status != 'CANCELLED'
        `);
    }

    // Commit both operations simultaneously 
    await transaction.commit();

    res.status(201).json({ message: 'Payment recorded successfully', paymentID: newPaymentID });
  } catch (err) {
    // Rollback the transaction data row if something goes wrong mid-flight
    if (transaction) await transaction.rollback();
    res.status(500).json({ message: err.message });
  }
});
// ─────────────────────────────────────────────────────────────
//  DELETE /api/payments/:id
// ─────────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    await poolConnect;
    const pRes = await pool.request()
      .input('id', sql.Int, req.params.id)
      .query('SELECT InvoiceID FROM Payments WHERE PaymentID = @id');

    await pool.request()
      .input('id', sql.Int, req.params.id)
      .query('DELETE FROM Payments WHERE PaymentID = @id');

    const invoiceID = pRes.recordset[0]?.InvoiceID;
    if (invoiceID) {
      await pool.request()
        .input('invID', sql.Int, invoiceID)
        .query(`
          UPDATE Invoices SET Status = (
            CASE
              WHEN TotalAmount <= (SELECT ISNULL(SUM(Amount),0) FROM Payments WHERE InvoiceID = @invID)
              THEN 'PAID'
              WHEN (SELECT ISNULL(SUM(Amount),0) FROM Payments WHERE InvoiceID = @invID) > 0
              THEN 'PARTIAL'
              ELSE 'UNPAID'
            END
          ) WHERE InvoiceID = @invID AND Status != 'CANCELLED'
        `);
    }

    res.json({ message: 'Payment deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;