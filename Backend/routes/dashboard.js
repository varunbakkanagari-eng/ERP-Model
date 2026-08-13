const express = require('express');
const router  = express.Router();
const { pool, poolConnect } = require('../connection');

router.get('/', async (req, res) => {
  try {
    await poolConnect;

    const [summaryRes, topCustRes, lowStockRes, recentInvRes] = await Promise.all([

      pool.request().query(`
        SELECT
          (SELECT ISNULL(SUM(Quantity),0) FROM Stock)                   AS TotalStock,
          (SELECT COUNT(*) FROM Customers)                              AS TotalCustomers,
          (SELECT COUNT(*) FROM Invoices WHERE Status != 'CANCELLED')   AS TotalInvoices,
          (SELECT COUNT(*) FROM Invoices
           WHERE CONVERT(date, InvoiceDate) = CONVERT(date, GETDATE())
             AND Status != 'CANCELLED')                                 AS TodayInvoices,
          (SELECT ISNULL(SUM(TotalAmount),0) FROM Invoices
           WHERE Status != 'CANCELLED')                                 AS TotalSales,
          (SELECT ISNULL(SUM(Amount),0) FROM Payments)                  AS TotalCollected,
          (SELECT ISNULL(SUM(TotalAmount),0) FROM Invoices
           WHERE Status != 'CANCELLED') -
          (SELECT ISNULL(SUM(Amount),0) FROM Payments)                  AS TotalOutstanding
      `),

      pool.request().query(`
        SELECT TOP 10
               c.CustomerID, c.FullName, c.Phone,
               ISNULL(inv.TotalInvoiced, 0) - ISNULL(pay.TotalPaid, 0) AS Balance
        FROM   dbo.Customers c
        LEFT JOIN (
          SELECT CustomerID, SUM(TotalAmount) AS TotalInvoiced
          FROM   dbo.Invoices
          WHERE  Status != 'CANCELLED'
          GROUP BY CustomerID
        ) inv ON c.CustomerID = inv.CustomerID
        LEFT JOIN (
          SELECT CustomerID, SUM(Amount) AS TotalPaid
          FROM   dbo.Payments
          GROUP BY CustomerID
        ) pay ON c.CustomerID = pay.CustomerID
        WHERE  ISNULL(inv.TotalInvoiced, 0) - ISNULL(pay.TotalPaid, 0) > 0
        ORDER  BY Balance DESC
      `),

      pool.request().query(`
        SELECT b.SizeInch, b.SizeMM,
               ISNULL(s.Quantity,0) AS Quantity,
               ISNULL(s.LowStockAlert, 500) AS LowStockAlert
        FROM   dbo.BrickSizes b
        LEFT JOIN dbo.Stock s ON b.BrickID = s.BrickID
        WHERE  ISNULL(s.Quantity,0) <= ISNULL(s.LowStockAlert, 500)
        ORDER  BY Quantity ASC
      `),

      pool.request().query(`
        SELECT TOP 10
               i.InvoiceID, i.InvoiceNumber, i.InvoiceDate, i.Status, i.TotalAmount,
               c.FullName AS CustomerName
        FROM   Invoices i
        JOIN   Customers c ON i.CustomerID = c.CustomerID
        ORDER  BY i.InvoiceDate DESC, i.InvoiceID DESC
      `),
    ]);

    res.json({
      data: {
        summary:        summaryRes.recordset[0],
        topCustomers:   topCustRes.recordset,
        lowStock:       lowStockRes.recordset,
        recentInvoices: recentInvRes.recordset,
      },
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
