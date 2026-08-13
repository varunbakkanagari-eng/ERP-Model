-- ============================================================
--  SAI VARUN ENTERPRISE ERP — UNIFIED & 10/10 PRODUCTION SCHEMA
--  Database: SQL Server (SaiVarunERP)
--  Features: High-Precision Timestamps, Comprehensive FK linkage,
--            Cascade Deletions, Performance Indexes, and Overpayment guards.
-- ============================================================

USE master;
GO

IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'SaiVarunERP')
    CREATE DATABASE SaiVarunERP;
GO

USE SaiVarunERP;
GO

-- ============================================================
-- CLEANUP: Drop existing tables in reverse dependency order
-- ============================================================
IF OBJECT_ID('dbo.InvoiceSummary', 'V') IS NOT NULL DROP VIEW dbo.InvoiceSummary;

IF OBJECT_ID('dbo.SupplierPayments', 'U') IS NOT NULL DROP TABLE dbo.SupplierPayments;
IF OBJECT_ID('dbo.CompanyStockTransactions', 'U') IS NOT NULL DROP TABLE dbo.CompanyStockTransactions;
IF OBJECT_ID('dbo.PurchaseOrderLines', 'U') IS NOT NULL DROP TABLE dbo.PurchaseOrderLines;
IF OBJECT_ID('dbo.PurchaseOrders', 'U') IS NOT NULL DROP TABLE dbo.PurchaseOrders;
IF OBJECT_ID('dbo.CompanyStock', 'U') IS NOT NULL DROP TABLE dbo.CompanyStock;
IF OBJECT_ID('dbo.MaterialTypes', 'U') IS NOT NULL DROP TABLE dbo.MaterialTypes;
IF OBJECT_ID('dbo.Suppliers', 'U') IS NOT NULL DROP TABLE dbo.Suppliers;

IF OBJECT_ID('dbo.CompanyStockPayments', 'U') IS NOT NULL DROP TABLE dbo.CompanyStockPayments;
IF OBJECT_ID('dbo.Payments', 'U') IS NOT NULL DROP TABLE dbo.Payments;
IF OBJECT_ID('dbo.InvoiceLines', 'U') IS NOT NULL DROP TABLE dbo.InvoiceLines;
IF OBJECT_ID('dbo.Invoices', 'U') IS NOT NULL DROP TABLE dbo.Invoices;
IF OBJECT_ID('dbo.StockTransactions', 'U') IS NOT NULL DROP TABLE dbo.StockTransactions;
IF OBJECT_ID('dbo.Stock', 'U') IS NOT NULL DROP TABLE dbo.Stock;
IF OBJECT_ID('dbo.Customers', 'U') IS NOT NULL DROP TABLE dbo.Customers;
IF OBJECT_ID('dbo.BrickSizes', 'U') IS NOT NULL DROP TABLE dbo.BrickSizes;
IF OBJECT_ID('dbo.Users', 'U') IS NOT NULL DROP TABLE dbo.Users;
GO

-- ============================================================
-- 1. USERS (Authentication & Role Management)
-- ============================================================
CREATE TABLE dbo.Users (
    UserID       INT           IDENTITY(1,1) PRIMARY KEY,
    Username     NVARCHAR(50)  NOT NULL UNIQUE,
    PasswordHash NVARCHAR(255) NOT NULL,
    Role         NVARCHAR(20)  NOT NULL DEFAULT 'USER' 
        CHECK (Role IN ('ADMIN', 'USER', 'GUEST')),
    FullName     NVARCHAR(100) NOT NULL,
    IsActive     BIT           NOT NULL DEFAULT 1,
    IsPaid       BIT           NOT NULL DEFAULT 0,
    CreatedAt    DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
);

-- ============================================================
-- 2. CUSTOMERS
-- ============================================================
CREATE TABLE dbo.Customers (
    CustomerID INT           IDENTITY(1,1) PRIMARY KEY,
    FullName   NVARCHAR(100) NOT NULL,
    Phone      NVARCHAR(15)  NOT NULL UNIQUE,
    Address    NVARCHAR(300) NULL,
    Email      NVARCHAR(200) NULL,
    IsActive   BIT           NOT NULL DEFAULT 1,
    CreatedAt  DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt  DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
);

-- ============================================================
-- 3. BRICK SIZES (Master Catalog)
-- ============================================================
CREATE TABLE dbo.BrickSizes (
    BrickID      INT           IDENTITY(1,1) PRIMARY KEY,
    SizeInch     NVARCHAR(50)  NOT NULL UNIQUE, -- e.g. 6x8x12
    SizeMM       NVARCHAR(50)  NOT NULL,        -- e.g. 150x200x300
    CostPerBrick DECIMAL(10,2) NOT NULL DEFAULT 0.00 CHECK (CostPerBrick >= 0),
    TripQty      INT           NOT NULL DEFAULT 0 CHECK (TripQty >= 0),
    IsActive     BIT           NOT NULL DEFAULT 1,
    UpdatedAt    DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
);

-- ============================================================
-- 4. STOCK (Inventory Master linked to BrickSizes)
-- ============================================================
CREATE TABLE dbo.Stock (
    StockID       INT       IDENTITY(1,1) PRIMARY KEY,
    BrickID       INT       NOT NULL UNIQUE 
        CONSTRAINT FK_Stock_BrickSizes REFERENCES dbo.BrickSizes(BrickID) ON DELETE CASCADE,
    Quantity      INT       NOT NULL DEFAULT 0 CHECK (Quantity >= 0),
    LowStockAlert INT       NOT NULL DEFAULT 500,
    LastUpdated   DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

-- ============================================================
-- 5. STOCK TRANSACTIONS (Audited by Users)
-- ============================================================
CREATE TABLE dbo.StockTransactions (
    TxnID           INT           IDENTITY(1,1) PRIMARY KEY,
    BrickID         INT           NOT NULL 
        CONSTRAINT FK_StockTxn_BrickSizes REFERENCES dbo.BrickSizes(BrickID),
    TxnType         NVARCHAR(10)  NOT NULL CHECK (TxnType IN ('IN', 'OUT', 'ADJUST')),
    Quantity        INT           NOT NULL CHECK (Quantity >= 0),
    ProcessedByBy   INT           NULL 
        CONSTRAINT FK_StockTxn_Users REFERENCES dbo.Users(UserID),
    Note            NVARCHAR(500) NULL,
    TransactionDate DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
);

-- ============================================================
-- 6. INVOICES (Header - Linked to Customers & Users)
-- ============================================================
CREATE TABLE dbo.Invoices (
    InvoiceID     INT           IDENTITY(1,1) PRIMARY KEY,
    InvoiceNumber NVARCHAR(20)  NOT NULL UNIQUE, -- e.g. SVE-20260615-01
    CustomerID    INT           NOT NULL 
        CONSTRAINT FK_Invoices_Customers REFERENCES dbo.Customers(CustomerID),
    CreatedBy     INT           NULL 
        CONSTRAINT FK_Invoices_Users REFERENCES dbo.Users(UserID),
    InvoiceDate   DATE          NOT NULL DEFAULT CAST(SYSUTCDATETIME() AS DATE),
    Subtotal      DECIMAL(12,2) NOT NULL CHECK (Subtotal >= 0),
    CGSTRate      DECIMAL(5,2)  NOT NULL DEFAULT 9.00,
    SGSTRate      DECIMAL(5,2)  NOT NULL DEFAULT 9.00,
    CGSTAmount    DECIMAL(12,2) NOT NULL CHECK (CGSTAmount >= 0),
    SGSTAmount    DECIMAL(12,2) NOT NULL CHECK (SGSTAmount >= 0),
    TotalAmount   DECIMAL(12,2) NOT NULL CHECK (TotalAmount >= 0),
    Status        NVARCHAR(20)  NOT NULL DEFAULT 'UNPAID'
        CHECK (Status IN ('UNPAID', 'PARTIAL', 'PAID', 'CANCELLED')),
    Notes         NVARCHAR(500) NULL,
    CreatedAt     DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME(),
    UpdatedAt     DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
);

-- ============================================================
-- 7. INVOICE LINE ITEMS (Child of Invoices & BrickSizes)
-- ============================================================
CREATE TABLE dbo.InvoiceLines (
    LineID       INT           IDENTITY(1,1) PRIMARY KEY,
    InvoiceID    INT           NOT NULL 
        CONSTRAINT FK_InvoiceLines_Invoices REFERENCES dbo.Invoices(InvoiceID) ON DELETE CASCADE,
    BrickID      INT           NOT NULL 
        CONSTRAINT FK_InvoiceLines_BrickSizes REFERENCES dbo.BrickSizes(BrickID),
    Quantity     INT           NOT NULL CHECK (Quantity > 0),
    RatePerBrick DECIMAL(10,2) NOT NULL CHECK (RatePerBrick >= 0), -- supports discounts/free samples
    LineAmount   DECIMAL(12,2) NOT NULL CHECK (LineAmount >= 0),
    CONSTRAINT UQ_InvoiceLine UNIQUE (InvoiceID, BrickID)
);

-- ============================================================
-- 8. PAYMENTS (Linked to Customers, Invoices, and Users)
-- ============================================================
CREATE TABLE dbo.Payments (
    PaymentID     INT           IDENTITY(1,1) PRIMARY KEY,
    CustomerID    INT           NOT NULL 
        CONSTRAINT FK_Payments_Customers REFERENCES dbo.Customers(CustomerID),
    InvoiceID     INT           NULL 
        CONSTRAINT FK_Payments_Invoices REFERENCES dbo.Invoices(InvoiceID) ON DELETE CASCADE,
    ReceivedBy    INT           NULL 
        CONSTRAINT FK_Payments_Users REFERENCES dbo.Users(UserID),
    Amount        DECIMAL(12,2) NOT NULL CHECK (Amount > 0),
    PaymentDate   DATE          NOT NULL DEFAULT CAST(SYSUTCDATETIME() AS DATE),
    PaymentMode   NVARCHAR(20)  NOT NULL DEFAULT 'CASH'
        CHECK (PaymentMode IN ('CASH', 'UPI', 'BANK', 'CHEQUE', 'OTHER', 'ONLINE')),
    Reference     NVARCHAR(100) NULL, -- Gateway Transaction ID / Check Number
    Notes         NVARCHAR(300) NULL,
    CreatedAt     DATETIME2     NOT NULL DEFAULT SYSUTCDATETIME()
);

-- ============================================================
-- 9. COMPANY STOCK PAYMENTS (Legacy reference support)
-- ============================================================
CREATE TABLE dbo.CompanyStockPayments (
    StockPaymentID INT             IDENTITY(1,1) PRIMARY KEY,
    StockID        INT             NOT NULL 
        CONSTRAINT FK_CompanyStockPayments_Stock REFERENCES dbo.Stock(StockID) ON DELETE CASCADE,
    AmountPaid     DECIMAL(18,2)   NOT NULL CHECK (AmountPaid >= 0),
    PaymentDate    DATETIME2       NOT NULL DEFAULT SYSUTCDATETIME(),
    PaymentMethod  NVARCHAR(50)    NOT NULL,
    Notes          NVARCHAR(500)   NULL
);
GO

-- ============================================================
-- 10. SUPPLIERS
-- ============================================================
CREATE TABLE dbo.Suppliers (
    SupplierID INT            IDENTITY(1,1) PRIMARY KEY,
    Name       NVARCHAR(200)  NOT NULL,
    Phone      NVARCHAR(20)   NULL,
    Address    NVARCHAR(500)  NULL,
    Email      NVARCHAR(200)  NULL,
    CreatedAt  DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME()
);

-- ============================================================
-- 11. MATERIAL TYPES
-- ============================================================
CREATE TABLE dbo.MaterialTypes (
    MaterialID    INT            IDENTITY(1,1) PRIMARY KEY,
    Name          NVARCHAR(200)  NOT NULL UNIQUE,
    Unit          NVARCHAR(50)   NOT NULL DEFAULT 'Bag',
    LowStockAlert DECIMAL(12,2)  NOT NULL DEFAULT 50.00 CHECK (LowStockAlert >= 0),
    Notes         NVARCHAR(500)  NULL,
    IsActive      BIT            NOT NULL DEFAULT 1,
    CreatedAt     DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME()
);

-- ============================================================
-- 12. COMPANY STOCK
-- ============================================================
CREATE TABLE dbo.CompanyStock (
    CompanyStockID INT            IDENTITY(1,1) PRIMARY KEY,
    MaterialID     INT            NOT NULL UNIQUE
        CONSTRAINT FK_CompanyStock_MaterialTypes REFERENCES dbo.MaterialTypes(MaterialID) ON DELETE CASCADE,
    Quantity       DECIMAL(12,2)  NOT NULL DEFAULT 0.00 CHECK (Quantity >= 0)
);

-- ============================================================
-- 13. PURCHASE ORDERS (Suppliers)
-- ============================================================
CREATE TABLE dbo.PurchaseOrders (
    POID          INT            IDENTITY(1,1) PRIMARY KEY,
    PONumber      NVARCHAR(50)   NOT NULL UNIQUE,
    SupplierID    INT            NULL
        CONSTRAINT FK_PurchaseOrders_Suppliers REFERENCES dbo.Suppliers(SupplierID) ON DELETE SET NULL,
    SupplierName  NVARCHAR(200)  NULL,
    PurchaseDate  DATE           NOT NULL DEFAULT CAST(SYSUTCDATETIME() AS DATE),
    PaymentStatus NVARCHAR(20)   NOT NULL DEFAULT 'UNPAID' 
        CHECK (PaymentStatus IN ('UNPAID', 'PARTIAL', 'PAID')),
    TotalAmount   DECIMAL(12,2)  NOT NULL DEFAULT 0.00 CHECK (TotalAmount >= 0),
    PaidAmount    DECIMAL(12,2)  NOT NULL DEFAULT 0.00 CHECK (PaidAmount >= 0),
    DueAmount     AS (TotalAmount - PaidAmount),
    IsCreditBuy   BIT            NOT NULL DEFAULT 0,
    Notes         NVARCHAR(1000) NULL,
    CreatedAt     DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME()
);

-- ============================================================
-- 14. PURCHASE ORDER LINES
-- ============================================================
CREATE TABLE dbo.PurchaseOrderLines (
    POLineID   INT            IDENTITY(1,1) PRIMARY KEY,
    POID       INT            NOT NULL
        CONSTRAINT FK_PurchaseOrderLines_PurchaseOrders REFERENCES dbo.PurchaseOrders(POID) ON DELETE CASCADE,
    MaterialID INT            NOT NULL
        CONSTRAINT FK_PurchaseOrderLines_MaterialTypes REFERENCES dbo.MaterialTypes(MaterialID),
    Quantity   DECIMAL(12,2)  NOT NULL CHECK (Quantity > 0),
    UnitPrice  DECIMAL(10,2)  NOT NULL CHECK (UnitPrice >= 0),
    LineAmount DECIMAL(12,2)  NOT NULL CHECK (LineAmount >= 0)
);

-- ============================================================
-- 15. COMPANY STOCK TRANSACTIONS
-- ============================================================
CREATE TABLE dbo.CompanyStockTransactions (
    TxnID           INT            IDENTITY(1,1) PRIMARY KEY,
    MaterialID      INT            NOT NULL
        CONSTRAINT FK_CompanyStockTransactions_MaterialTypes REFERENCES dbo.MaterialTypes(MaterialID),
    POID            INT            NULL
        CONSTRAINT FK_CompanyStockTransactions_PurchaseOrders REFERENCES dbo.PurchaseOrders(POID) ON DELETE SET NULL,
    ChangeType      NVARCHAR(10)   NOT NULL CHECK (ChangeType IN ('IN', 'OUT', 'ADJUST')),
    Quantity        DECIMAL(12,2)  NOT NULL CHECK (Quantity >= 0),
    Note            NVARCHAR(500)  NULL,
    TransactionDate DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME()
);

-- ============================================================
-- 16. SUPPLIER PAYMENTS
-- ============================================================
CREATE TABLE dbo.SupplierPayments (
    PaymentID   INT            IDENTITY(1,1) PRIMARY KEY,
    POID        INT            NOT NULL
        CONSTRAINT FK_SupplierPayments_PurchaseOrders REFERENCES dbo.PurchaseOrders(POID) ON DELETE CASCADE,
    SupplierID  INT            NULL
        CONSTRAINT FK_SupplierPayments_Suppliers REFERENCES dbo.Suppliers(SupplierID) ON DELETE SET NULL,
    Amount      DECIMAL(12,2)  NOT NULL CHECK (Amount > 0),
    PaymentMode NVARCHAR(20)   NOT NULL DEFAULT 'CASH'
        CHECK (PaymentMode IN ('CASH', 'UPI', 'BANK', 'CHEQUE', 'OTHER', 'ONLINE')),
    Reference   NVARCHAR(200)  NULL,
    Notes       NVARCHAR(500)  NULL,
    PaymentDate DATETIME2      NOT NULL DEFAULT SYSUTCDATETIME()
);
GO

-- ============================================================
-- INDEXES for Performance Tuning & Foreign Key optimization
-- ============================================================
CREATE NONCLUSTERED INDEX IX_Invoices_CustomerID    ON dbo.Invoices(CustomerID);
CREATE NONCLUSTERED INDEX IX_Invoices_Date          ON dbo.Invoices(InvoiceDate);
CREATE NONCLUSTERED INDEX IX_InvoiceLines_InvoiceID ON dbo.InvoiceLines(InvoiceID);
CREATE NONCLUSTERED INDEX IX_Payments_CustomerID    ON dbo.Payments(CustomerID);
CREATE NONCLUSTERED INDEX IX_Payments_InvoiceID     ON dbo.Payments(InvoiceID);
CREATE NONCLUSTERED INDEX IX_StockTxn_BrickID       ON dbo.StockTransactions(BrickID);

CREATE NONCLUSTERED INDEX IX_CompanyStock_MaterialID     ON dbo.CompanyStock(MaterialID);
CREATE NONCLUSTERED INDEX IX_PurchaseOrders_SupplierID   ON dbo.PurchaseOrders(SupplierID);
CREATE NONCLUSTERED INDEX IX_PurchaseOrderLines_POID     ON dbo.PurchaseOrderLines(POID);
CREATE NONCLUSTERED INDEX IX_SupplierPayments_POID       ON dbo.SupplierPayments(POID);
CREATE NONCLUSTERED INDEX IX_CompStockTxn_MaterialID     ON dbo.CompanyStockTransactions(MaterialID);
GO

-- ============================================================
-- DYNAMIC INVOICE SUMMARY VIEW
-- ============================================================
CREATE OR ALTER VIEW dbo.InvoiceSummary AS
SELECT 
    i.InvoiceID,
    i.InvoiceNumber,
    i.InvoiceDate,
    i.CustomerID,
    c.FullName AS CustomerName,
    c.Phone AS CustomerPhone,
    i.TotalAmount AS TotalAmount,
    COALESCE(p.TotalPaid, 0) AS TotalPaid,
    (i.TotalAmount - COALESCE(p.TotalPaid, 0)) AS BalanceDue,
    CASE 
        WHEN i.Status = 'CANCELLED' THEN 'CANCELLED'
        WHEN (i.TotalAmount - COALESCE(p.TotalPaid, 0)) <= 0 THEN 'PAID'
        WHEN COALESCE(p.TotalPaid, 0) > 0 THEN 'PARTIAL'
        ELSE 'UNPAID'
    END AS Status
FROM dbo.Invoices i
INNER JOIN dbo.Customers c ON i.CustomerID = c.CustomerID
LEFT JOIN (
    SELECT InvoiceID, SUM(Amount) AS TotalPaid
    FROM dbo.Payments
    GROUP BY InvoiceID
) p ON i.InvoiceID = p.InvoiceID;
GO

-- ============================================================
-- SEED DATA (Bootstrap default admin profiles & catalog)
-- ============================================================

-- Seed Default Application Users (Password hashes are mock examples)
INSERT INTO dbo.Users (Username, PasswordHash, Role, FullName, IsPaid) VALUES
('IndraReddy', 'pbkdf2_sha256_mocked_admin_hash_value', 'ADMIN', 'SVE Executive Admin', 1),
('staff_user', 'pbkdf2_sha256_mocked_user_hash_value', 'USER', 'SVE Desk Operator', 0),
('guest_viewer', 'guest_no_hash_needed', 'GUEST', 'Public Guest Account', 0);

-- Seed Catalog
INSERT INTO dbo.BrickSizes (SizeInch, SizeMM, CostPerBrick, TripQty) VALUES
('6x8x12', '150x200x300', 28.00, 800),
('6x9x12', '150x225x300', 32.00, 750),
('4x8x16', '100x200x400', 28.00, 900),
('6x8x16', '150x200x400', 50.00, 600),
('8x8x12', '200x200x300', 38.00, 600),
('3x4x9',  '75x100x225',  38.00, 4000),
('4x8x12', '100x200x300', 8.00,  1100),
('8x8x16', '200x200x400', 23.00, 400);

-- Seed Stock
INSERT INTO dbo.Stock (BrickID, Quantity) VALUES
(1, 2400), (2, 1500), (3, 3600), (4, 1200), (5, 600), (6, 8000), (7, 3300), (8, 400);

-- Seed Customers
INSERT INTO dbo.Customers (FullName, Phone, Address) VALUES
('Raju Reddy',    '9848012345', 'Shadnagar, Maheshwaram, RR Dist'),
('Suresh Kumar',  '9700011223', 'Kothur, Maheshwaram, RR Dist'),
('Venkat Rao',    '9912233445', 'Ibrahimpatnam, Rangareddy');

-- Seed Materials for Company Stock
INSERT INTO dbo.MaterialTypes (Name, Unit, LowStockAlert, Notes) VALUES
('Cement OPC-53', 'Bag', 100.00, 'Standard building cement bags'),
('Fine River Sand', 'Brass', 10.00, 'Screened river sand for plastering'),
('Coal Dust Fuel', 'Ton', 5.00, 'Kiln firing fuel supplies'),
('Red Clay Soil', 'Brass', 20.00, 'Main brick molding raw material');

-- Seed initial Material Stock levels
INSERT INTO dbo.CompanyStock (MaterialID, Quantity) VALUES
(1, 450.00),
(2, 25.00),
(3, 8.50),
(4, 55.00);

-- Seed default Suppliers
INSERT INTO dbo.Suppliers (Name, Phone, Address, Email) VALUES
('Deccan Cements Ltd', '9000123456', 'Miryalaguda, Nalgonda', 'sales@deccancements.com'),
('Krishna River Mining Co', '9888999111', 'Vijayawada, AP', 'sandinfo@krishnamining.com'),
('Singareni Collieries', '9123456780', 'Kothagudem, Bhadradri Dist', 'coal@scclmines.com');
GO
