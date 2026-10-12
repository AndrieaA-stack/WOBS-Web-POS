process.on('uncaughtException', (err) => {
  console.error('💥 UNCAUGHT EXCEPTION:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 UNHANDLED REJECTION at:', promise, 'reason:', reason);
});

const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
app.use(cors());

// High payload limits for base64 images
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Database Connection
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'wobs_db',
  password: 'gab',
  port: 5432,
});

// Non-blocking connection test
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Database connection error:', err.message);
  } else {
    console.log('✅ Connected to PostgreSQL database: wobs_db');
  }
});

// Pool error handling
pool.on('error', (err) => {
  console.error('Unexpected pool error on idle client:', err);
});

// Startup connection verification
pool.connect((err, client, release) => {
  if (err) {
    return console.error('❌ Error connecting to PostgreSQL:', err.stack);
  }
  console.log(' Connected to PostgreSQL database: wobs_db');
  release();
});

// Initialize Admin & Status Tables
// Initialize Database Tables
async function initDb() {
  try {
    // 1. Approved Admin Accounts Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admin_accounts (
        id SERIAL PRIMARY KEY,
        fullname VARCHAR(100) NOT NULL,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Separate Pending Admin Accounts Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS pending_admin_accounts (
        id SERIAL PRIMARY KEY,
        fullname VARCHAR(100) NOT NULL,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(100) NOT NULL,
        requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 3. Seed Gabriel / Gabriel123 into admin_accounts
    await pool.query(`
      INSERT INTO admin_accounts (fullname, username, password)
      VALUES ('Primary Admin', 'Gabriel', 'Gabriel123')
      ON CONFLICT (username) DO UPDATE SET password = 'Gabriel123';
    `);
    console.log("👑 Primary admin seeded in admin_accounts: Gabriel / Gabriel123");
  } catch (err) {
    console.error("❌ DB Table init error:", err.message);
  }
}
initDb();

// ---------------- ADMIN ENDPOINTS ----------------

// POST: Admin Login (Checks active admin_accounts table)
app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query(
      `SELECT * FROM admin_accounts WHERE LOWER(username) = LOWER($1) AND password = $2`,
      [username, password]
    );

    if (result.rows.length === 0) {
      // Check if account is still in pending_admin_accounts
      const pendingCheck = await pool.query(
        `SELECT * FROM pending_admin_accounts WHERE LOWER(username) = LOWER($1)`,
        [username]
      );

      if (pendingCheck.rows.length > 0) {
        return res.status(403).json({
          success: false,
          message: "Your account request is still PENDING approval from an existing Admin."
        });
      }

      return res.status(401).json({ success: false, message: "Invalid username or password." });
    }

    const user = result.rows[0];
    res.json({ success: true, user: { username: user.username, fullname: user.fullname } });
  } catch (err) {
    res.status(500).json({ success: false, message: "Database connection failed." });
  }
});

// POST: Register New Admin (Inserts into pending_admin_accounts table)
app.post('/api/admin/register', async (req, res) => {
  const { fullname, username, password } = req.body;
  try {
    // Check if username already exists in approved admins or pending requests
    const activeCheck = await pool.query(`SELECT 1 FROM admin_accounts WHERE LOWER(username) = LOWER($1)`, [username]);
    const pendingCheck = await pool.query(`SELECT 1 FROM pending_admin_accounts WHERE LOWER(username) = LOWER($1)`, [username]);

    if (activeCheck.rows.length > 0 || pendingCheck.rows.length > 0) {
      return res.status(400).json({ success: false, message: "Username already exists or is pending approval." });
    }

    await pool.query(
      `INSERT INTO pending_admin_accounts (fullname, username, password) VALUES ($1, $2, $3)`,
      [fullname, username, password]
    );

    res.json({ success: true, message: "Registration request submitted for approval." });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to submit request." });
  }
});

// GET: Fetch All Pending Requests (Reads from pending_admin_accounts)
app.get('/api/admin/pending', async (req, res) => {
  try {
    const result = await pool.query(`SELECT id, fullname, username, requested_at FROM pending_admin_accounts ORDER BY requested_at ASC`);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch pending requests." });
  }
});

// PUT: Approve or Reject Request (Transfers from pending_admin_accounts to admin_accounts)
app.put('/api/admin/approve/:id', async (req, res) => {
  const { id } = req.params;
  const { action } = req.body; // 'APPROVED' or 'REJECTED'

  try {
    if (action === 'APPROVED') {
      // Find pending user
      const pendingRes = await pool.query(`SELECT * FROM pending_admin_accounts WHERE id = $1`, [id]);
      if (pendingRes.rows.length === 0) {
        return res.status(404).json({ error: "Pending request not found." });
      }

      const pendingUser = pendingRes.rows[0];

      // Move into active admin_accounts
      await pool.query(
        `INSERT INTO admin_accounts (fullname, username, password) VALUES ($1, $2, $3)`,
        [pendingUser.fullname, pendingUser.username, pendingUser.password]
      );

      // Remove from pending_admin_accounts
      await pool.query(`DELETE FROM pending_admin_accounts WHERE id = $1`, [id]);
    } else {
      // Reject: delete request from pending_admin_accounts
      await pool.query(`DELETE FROM pending_admin_accounts WHERE id = $1`, [id]);
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Approval error:", err);
    res.status(500).json({ error: "Action failed." });
  }
});
initDb();

// ==================== HEALTH & PRODUCT ROUTES ====================

// GET: Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date() });
});

// GET: Fetch product catalog
app.get('/api/products', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products ORDER BY name ASC');
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching products:", err);
    res.status(500).json({ error: 'Failed to fetch products: ' + err.message });
  }
});

// POST: Add or Edit product entry
app.post('/api/products', async (req, res) => {
  const { id, barcode, name, category, cost, price, stock, expiry, image } = req.body;

  const sanitizedExpiry = (expiry && expiry.trim() !== '') ? expiry : null;
  const sanitizedImage = (image && image.trim() !== '' && image !== 'null') ? image : null;

  try {
    const query = `
      INSERT INTO products (id, barcode, name, category, cost, price, stock, expiry, image)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (id) DO UPDATE SET
        barcode = EXCLUDED.barcode,
        name = EXCLUDED.name,
        category = EXCLUDED.category,
        cost = EXCLUDED.cost,
        price = EXCLUDED.price,
        stock = EXCLUDED.stock,
        expiry = EXCLUDED.expiry,
        image = EXCLUDED.image
    `;

    await pool.query(query, [
      id, 
      barcode, 
      name, 
      category, 
      parseFloat(cost) || 0, 
      parseFloat(price) || 0, 
      parseInt(stock) || 0, 
      sanitizedExpiry, 
      sanitizedImage
    ]);

    res.json({ message: 'Product saved successfully' });
  } catch (err) {
    console.error("❌ POSTGRESQL ERROR:", err.message);
    res.status(500).json({ error: 'Failed to save product: ' + err.message });
  }
});

// DELETE: Remove product from database
app.delete('/api/products/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM products WHERE id = $1', [req.params.id]);
    res.json({ message: 'Product deleted successfully' });
  } catch (err) {
    console.error("Error deleting product:", err);
    res.status(500).json({ error: 'Failed to delete product: ' + err.message });
  }
});

// ==================== TRANSACTION & ORDER ROUTES ====================

// POST: Process atomic checkout transaction
app.post('/api/checkout', async (req, res) => {
  const { id, customerName, address, items, total, gcashRef, paymentProof } = req.body;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');


    const txnQuery = `
      INSERT INTO transactions (id, customer_name, address, gcash_ref, payment_proof, total, items, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `;
    await client.query(txnQuery, [
      id,
      customerName || 'Guest Customer',
      address, 
      gcashRef || 'SCREENSHOT_ATTACHED', 
      paymentProof || null, 
      total, 
      JSON.stringify(items),
      'Pending'
    ]);


    for (const item of items) {
      const updateStockQuery = `
        UPDATE products 
        SET stock = stock - $1 
        WHERE id = $2 AND stock >= $1
      `;
      const result = await client.query(updateStockQuery, [item.qty, item.id]);
      if (result.rowCount === 0) {
        throw new Error(`Insufficient stock or item not found for ID: ${item.id}`);
      }
    }

    await client.query('COMMIT');
    
    res.status(200).json({ message: 'Order processed successfully', txnId: id });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("❌ Transaction Error:", err.message);
    res.status(500).json({ error: 'Database error: ' + err.message });
  } finally {
    client.release();
  }
});

// GET: Fetch transactions
app.get('/api/transactions', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM transactions ORDER BY date_created DESC');
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching transactions:", err);
    res.status(500).json({ error: 'Failed to fetch transactions: ' + err.message });
  }
});

// PUT: Update transaction status
app.put('/api/transactions/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const cleanId = String(id).replace('WOBS-', '').replace('#', '');

  try {
    const query = `
      UPDATE transactions 
      SET status = $1 
      WHERE id LIKE $2 OR id = $3
    `;
    const result = await pool.query(query, [status, `%${cleanId}%`, id]);

    if (result.rowCount > 0) {
      res.json({ success: true, message: 'Status updated successfully', status });
    } else {
      res.status(404).json({ error: 'Transaction ID not found' });
    }
  } catch (err) {
    console.error("❌ Error updating status:", err.message);
    res.status(500).json({ error: 'Database status update failed: ' + err.message });
  }
});

// ==================== ADMIN AUTH & APPROVAL ROUTES ====================

// POST: Admin Login Endpoint
app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query(
      `SELECT * FROM admin_accounts WHERE LOWER(username) = LOWER($1) AND password = $2`,
      [username, password]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: "Invalid username or password." });
    }

    const user = result.rows[0];
    if (user.status !== 'APPROVED') {
      return res.status(403).json({ 
        success: false, 
        message: "Your account request is still PENDING approval from an existing Admin." 
      });
    }

    res.json({ success: true, user: { username: user.username, fullname: user.fullname } });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ success: false, message: "Database connection failed." });
  }
});

// POST: Register New Admin
app.post('/api/admin/register', async (req, res) => {
  const { fullname, username, password } = req.body;
  try {
    await pool.query(
      `INSERT INTO admin_accounts (fullname, username, password, status) VALUES ($1, $2, $3, 'PENDING')`,
      [fullname, username, password]
    );
    res.json({ success: true, message: "Registration submitted for approval." });
  } catch (err) {
    res.status(400).json({ success: false, message: "Username already exists." });
  }
});

// GET: Fetch Pending Admin Requests
app.get('/api/admin/pending', async (req, res) => {
  try {
    const result = await pool.query(`SELECT id, fullname, username, created_at FROM admin_accounts WHERE status = 'PENDING'`);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch pending requests." });
  }
});

// PUT: Approve or Reject Admin Account
app.put('/api/admin/approve/:id', async (req, res) => {
  const { id } = req.params;
  const { action } = req.body;
  try {
    if (action === 'APPROVED') {
      await pool.query(`UPDATE admin_accounts SET status = 'APPROVED' WHERE id = $1`, [id]);
    } else {
      await pool.query(`DELETE FROM admin_accounts WHERE id = $1`, [id]);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Action failed." });
  }
});

// ==================== SERVER LISTEN ====================

const PORT = 5000;

const server = app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use! Kill existing node processes or restart VS Code.`);
  } else {
    console.error('❌ Server error:', err);
  }
});