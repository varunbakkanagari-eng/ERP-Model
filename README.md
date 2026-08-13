# Sai Varun Enterprise ERP 🧱

A modern, full-stack Enterprise Resource Planning (ERP) application tailored for managing inventory, customers, finances, and day-to-day business operations efficiently. Built with performance and a clean, responsive UI in mind.

## 🌟 Key Features

* **Real-time Dashboard**: Comprehensive overview of revenue, stock levels, and critical business metrics.
* **Inventory Management**: Track end-product stock (bricks) alongside raw material inventory (company stock).
* **Customer Relations**: Manage client profiles, contact information, and purchase histories.
* **Advanced Invoicing**: Generate, track, and manage invoices with line-item precision.
* **Financial Ledger**: Monitor incoming and outgoing transactions, payments, and overall cash flow.
* **Automated Alerts**: Low-stock warnings and overdue payment notifications.
* **Mobile-Responsive**: Perfectly optimized layouts for desktop, tablet, and mobile browsers.

## 💻 Tech Stack

### Frontend (Client)
* **Framework**: [React.js](https://reactjs.org/)
* **Routing**: React Router DOM
* **Styling**: Custom Vanilla CSS (with responsive Flexbox/Grid layouts)
* **Animations**: Framer Motion
* **Icons**: Lucide React
* **HTTP Client**: Axios

### Backend (Server)
* **Environment**: [Node.js](https://nodejs.org/)
* **Framework**: Express.js
* **Database Driver**: `mssql` (Microsoft SQL Server driver for Node)
* **Security & Authentication**: JSON Web Tokens (JWT) & Bcrypt.js
* **Configuration**: Dotenv

### Database
* **Engine**: Microsoft SQL Server (T-SQL)
* **Schema Design**: Relational architecture with cascading constraints for strict data integrity.

---

## 🚀 Local Setup & Installation

### Prerequisites
* Node.js (v16+)
* Microsoft SQL Server & SQL Server Management Studio (SSMS)
* Git

### 1. Database Configuration
1. Open SQL Server Management Studio (SSMS).
2. Create a new database named `SaiVarunERP`.
3. Open and execute the `schema_10_10.sql` file provided in the root directory to generate all necessary tables and relations.

### 2. Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd Backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file based on `.env.example` and update your SQL Server credentials:
   ```env
   PORT=5000
   CLIENT_ORIGIN=http://localhost:3000
   DB_SERVER=Your_SQL_Server_Name
   DB_NAME=SaiVarunERP
   DB_USER=sa
   DB_PASSWORD=Your_Password
   JWT_SECRET=your_super_secret_key
   ```
4. Start the server:
   ```bash
   npm start
   ```

### 3. Frontend Setup
1. Open a new terminal window and navigate to the frontend directory:
   ```bash
   cd Frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the React application:
   ```bash
   npm start
   ```
4. The application will launch in your browser at `http://localhost:3000`.

---

## ☁️ Deployment

* **Frontend**: Optimized for deployment on **Vercel** or Netlify. Ensure the Root Directory is set to `Frontend`.
* **Backend**: Can be deployed on **Render**, **Railway**, or a standard VPS.
* **Database**: Requires a Cloud SQL Provider (e.g., Azure SQL Database, AWS RDS) for production environments.

---

*Designed and Developed by [Varun Bakkanagari](https://github.com/varunbakkanagari-eng)*
