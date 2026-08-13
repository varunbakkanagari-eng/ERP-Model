const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { pool, sql } = require('../connection');
const { authenticateToken } = require('../authMiddleware');

const JWT_SECRET = process.env.JWT_SECRET || 'brick_erp_secret_key_2026';

// POST /api/payment/create-order
// Protect with JWT token
router.post('/create-order', authenticateToken, (req, res) => {
  const { amount } = req.body;
  if (!amount || amount <= 0) {
    return res.status(400).json({ success: false, message: 'Invalid payment amount' });
  }

  // Generate a mock payment gateway order ID
  const orderId = 'order_' + Math.random().toString(36).substring(2, 15);
  res.json({
    success: true,
    orderId,
    amount,
    currency: 'INR',
    message: 'Mock payment order generated'
  });
});

// POST /api/payment/verify
// Protect with JWT token
router.post('/verify', authenticateToken, async (req, res) => {
  const { orderId, reference } = req.body;
  const userId = req.user.UserID;

  if (!orderId || !reference) {
    return res.status(400).json({ success: false, message: 'Payment verification elements missing' });
  }

  try {
    // 1. Ensure a valid Customer exists to satisfy Foreign Key constraints on Payments table
    let customerId;
    const custResult = await pool.request().query('SELECT TOP 1 CustomerID FROM dbo.Customers');
    
    if (custResult.recordset.length > 0) {
      customerId = custResult.recordset[0].CustomerID;
    } else {
      // Create a system billing customer if none exist
      const insertCust = await pool.request().query(`
        INSERT INTO dbo.Customers (FullName, Phone, Address)
        VALUES ('SaaS Subscription Billing', '0000000000', 'ERP SaaS System Account');
        SELECT SCOPE_IDENTITY() AS CustomerID;
      `);
      customerId = insertCust.recordset[0].CustomerID;
    }

    // 2. Insert transaction record in dbo.Payments
    const amountPaid = 999.00; // Standard premium access charge
    await pool.request()
      .input('customerId', sql.Int, customerId)
      .input('amount', sql.Decimal(10, 2), amountPaid)
      .input('reference', sql.NVarChar, reference || orderId)
      .query(`
        INSERT INTO dbo.Payments (CustomerID, PaymentDate, Amount, PaymentMode, Reference, Notes, CreatedAt)
        VALUES (@customerId, CAST(GETDATE() AS Date), @amount, 'ONLINE', @reference, 'BrickERP SaaS Subscription Access', SYSDATETIME())
      `);

    // 3. Upgrade user subscription state to Paid
    await pool.request()
      .input('userId', sql.Int, userId)
      .query('UPDATE dbo.Users SET IsPaid = 1 WHERE UserID = @userId');

    // 4. Fetch updated user details to sign a new token
    const userResult = await pool.request()
      .input('userId', sql.Int, userId)
      .query('SELECT * FROM dbo.Users WHERE UserID = @userId');

    const updatedUser = userResult.recordset[0];

    // 5. Generate and return a new JWT token reflecting paid status
    const payload = {
      UserID: updatedUser.UserID,
      Username: updatedUser.Username,
      FullName: updatedUser.FullName,
      Role: updatedUser.Role,
      IsPaid: true
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });

    res.json({
      success: true,
      message: 'Payment verified and access upgraded!',
      token,
      user: payload
    });
  } catch (err) {
    console.error('Payment verification error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
