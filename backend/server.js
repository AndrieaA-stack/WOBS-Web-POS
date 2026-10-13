process.on('uncaughtException', (err) => {
  console.error('💥 UNCAUGHT EXCEPTION:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 UNHANDLED REJECTION at:', promise, 'reason:', reason);
});

const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const fs = require('node:fs/promises');
const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const app = express();
app.use(cors());

// Middleware configuration (increase limit to 10mb for Base64 product photos & payment proof screenshots)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Dynamic Database Connection Pool (Local vs. Render Production)
const isProduction = process.env.NODE_ENV === 'production' || !!process.env.DATABASE_URL;

const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
      }
    : {
        user: process.env.PGUSER || 'postgres',
        host: process.env.PGHOST || 'localhost',
        database: process.env.PGDATABASE || 'wobs_db',
        password: process.env.PGPASSWORD || 'gab',
        port: Number(process.env.PGPORT) || 5432,
      }
);

pool.on('error', (err) => {
  console.error('Unexpected pool error on idle client:', err);
});

// Automatic Database Schema Migration & Verification
async function initDatabaseSchema() {
  try {
    console.log("🔄 Ensuring database schema and tables are initialized...");

    // 1. Ensure products table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS products (
        id VARCHAR(100) PRIMARY KEY,
        barcode VARCHAR(100),
        name VARCHAR(255) NOT NULL,
        category VARCHAR(100),
        cost NUMERIC(10, 2) NOT NULL,
        price NUMERIC(10, 2) NOT NULL,
        stock INTEGER NOT NULL,
        expiry DATE,
        image TEXT,
        image_url TEXT,
        date_added TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Ensure transactions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id VARCHAR(100) PRIMARY KEY,
        customer_id VARCHAR(100),
        customer_username VARCHAR(100),
        customer_name VARCHAR(150),
        address TEXT,
        gcash_ref VARCHAR(100),
        payment_proof TEXT,
        total NUMERIC(10, 2) NOT NULL,
        items JSONB NOT NULL,
        status VARCHAR(50) DEFAULT 'Pending',
        payment_method VARCHAR(50) DEFAULT 'GCash',
        date_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 3. Ensure transactions columns if table already existed without them
    await pool.query(`
      ALTER TABLE transactions ADD COLUMN IF NOT EXISTS customer_id VARCHAR(100);
      ALTER TABLE transactions ADD COLUMN IF NOT EXISTS customer_username VARCHAR(100);
      ALTER TABLE transactions ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT 'GCash';
    `);

    // 4. Ensure customers table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS customers (
        id VARCHAR(100) PRIMARY KEY,
        fullname VARCHAR(150) NOT NULL,
        username VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        city VARCHAR(100),
        barangay VARCHAR(100),
        street VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 5. Ensure admin_accounts table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admin_accounts (
        id SERIAL PRIMARY KEY,
        fullname VARCHAR(150) NOT NULL,
        username VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log("✅ Database schema verified & tables initialized successfully!");
  } catch (err) {
    console.error("⚠️ Database schema initialization note:", err.message);
  }
}

// Non-blocking database connection check
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Database connection error:', err.message);
  } else {
    console.log(`✅ Connected to PostgreSQL database (${isProduction ? 'Production/Render' : 'Local'})`);
    initDatabaseSchema();
  }
});

// Serve static frontend assets
app.use(express.static(path.join(__dirname, '..', 'frontend')));
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'Welcomepage.html'));
});


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

// POST: Add or Edit product entry (UPSERT on conflict)
app.post('/api/products', async (req, res) => {
  const { id, barcode, name, category, cost, price, stock, expiry, image } = req.body;

  const formattedExpiry = (expiry && String(expiry).trim() !== '' && expiry !== 'null') ? expiry : null;
  const formattedImage = (image && String(image).trim() !== '' && image !== 'null') ? image : null;

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
        image = EXCLUDED.image;
    `;

    await pool.query(query, [
      id,
      barcode,
      name,
      category,
      parseFloat(cost) || 0,
      parseFloat(price) || 0,
      parseInt(stock) || 0,
      formattedExpiry,
      formattedImage
    ]);

    res.json({ success: true, message: 'Product saved to database successfully' });
  } catch (err) {
    console.error("❌ POSTGRESQL ERROR:", err.message);
    res.status(500).json({ success: false, error: 'Failed to save product: ' + err.message });
  }
});

// DELETE: Remove product from database
app.delete('/api/products/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM products WHERE id = $1', [id]);
    res.json({ success: true, message: 'Product deleted successfully' });
  } catch (err) {
    console.error("Error deleting product:", err);
    res.status(500).json({ error: 'Failed to delete product: ' + err.message });
  }
});

// ==================== TRANSACTION & ORDER ROUTES ====================

// POST: Process atomic checkout transaction (Supports Customer Online Orders & Admin POS Walk-ins)
app.post('/api/checkout', async (req, res) => {
  const {
    id,
    customerId,
    customerUsername,
    customerName,
    address,
    items,
    total,
    gcashRef,
    paymentProof,
    paymentMethod,
    status
  } = req.body;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const txnQuery = `
      INSERT INTO transactions (id, customer_id, customer_username, customer_name, address, gcash_ref, payment_proof, total, items, status, payment_method)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `;
    await client.query(txnQuery, [
      id,
      customerId || null,
      customerUsername || null,
      customerName || 'Customer',
      address || 'In-Store POS / Walk-in',
      gcashRef || 'SCREENSHOT_ATTACHED',
      paymentProof || null,
      parseFloat(total) || 0,
      JSON.stringify(items),
      status || 'Pending',
      paymentMethod || 'GCash'
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

// ==================== CUSTOMER AUTH & ORDER ROUTES ====================

// POST: Register New Customer
app.post('/api/customer/register', async (req, res) => {
  const { fullname, username, password, phone, city, barangay, street } = req.body;
  if (!fullname || !username || !password) {
    return res.status(400).json({ success: false, message: "Full name, username, and password are required." });
  }

  try {
    const existingCheck = await pool.query(
      `SELECT 1 FROM customers WHERE LOWER(username) = LOWER($1)`,
      [username.trim()]
    );
    if (existingCheck.rows.length > 0) {
      return res.status(400).json({ success: false, message: "Username is already registered. Please choose another or login." });
    }

    const customerId = "cust_" + Date.now();
    await pool.query(
      `INSERT INTO customers (id, fullname, username, password, phone, city, barangay, street)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        customerId,
        fullname.trim(),
        username.trim(),
        password,
        phone ? phone.trim() : null,
        city ? city.trim() : null,
        barangay ? barangay.trim() : null,
        street ? street.trim() : null
      ]
    );

    const user = {
      id: customerId,
      fullname: fullname.trim(),
      username: username.trim(),
      phone: phone ? phone.trim() : '',
      city: city ? city.trim() : '',
      barangay: barangay ? barangay.trim() : '',
      street: street ? street.trim() : ''
    };

    res.json({ success: true, message: "Customer account created successfully!", user });
  } catch (err) {
    console.error("Customer register error:", err);
    res.status(500).json({ success: false, message: "Registration failed: " + err.message });
  }
});

// POST: Customer Login
app.post('/api/customer/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: "Username and password required." });
  }

  try {
    const result = await pool.query(
      `SELECT id, fullname, username, phone, city, barangay, street 
       FROM customers 
       WHERE LOWER(username) = LOWER($1) AND password = $2`,
      [username.trim(), password]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: "Invalid customer username or password." });
    }

    const user = result.rows[0];
    res.json({ success: true, message: "Welcome back!", user });
  } catch (err) {
    console.error("Customer login error:", err);
    res.status(500).json({ success: false, message: "Database connection failed." });
  }
});

// GET: Fetch Customer's Orders History
app.get('/api/customer/orders/:username', async (req, res) => {
  const { username } = req.params;
  try {
    const result = await pool.query(
      `SELECT * FROM transactions 
       WHERE LOWER(customer_username) = LOWER($1) 
       ORDER BY date_created DESC`,
      [username.trim()]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Fetch customer orders error:", err);
    res.status(500).json({ error: "Failed to fetch orders: " + err.message });
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
    console.error("Login error:", err);
    res.status(500).json({ success: false, message: "Database connection failed." });
  }
});

// POST: Register New Admin
app.post('/api/admin/register', async (req, res) => {
  const { fullname, username, password } = req.body;
  try {
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
    console.error("Registration error:", err);
    res.status(500).json({ success: false, message: "Failed to submit request." });
  }
});

// GET: Fetch Pending Admin Requests
app.get('/api/admin/pending', async (req, res) => {
  try {
    const result = await pool.query(`SELECT id, fullname, username, requested_at FROM pending_admin_accounts ORDER BY requested_at ASC`);
    res.json(result.rows);
  } catch (err) {
    console.error("Fetch pending error:", err);
    res.status(500).json({ error: "Failed to fetch pending requests." });
  }
});

// PUT: Approve or Reject Admin Account
app.put('/api/admin/approve/:id', async (req, res) => {
  const { id } = req.params;
  const { action } = req.body;

  try {
    if (action === 'APPROVED') {
      const pendingRes = await pool.query(`SELECT * FROM pending_admin_accounts WHERE id = $1`, [id]);
      if (pendingRes.rows.length === 0) {
        return res.status(404).json({ error: "Pending request not found." });
      }

      const pendingUser = pendingRes.rows[0];

      await pool.query(
        `INSERT INTO admin_accounts (fullname, username, password) VALUES ($1, $2, $3)`,
        [pendingUser.fullname, pendingUser.username, pendingUser.password]
      );

      await pool.query(`DELETE FROM pending_admin_accounts WHERE id = $1`, [id]);
    } else {
      await pool.query(`DELETE FROM pending_admin_accounts WHERE id = $1`, [id]);
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Approval error:", err);
    res.status(500).json({ error: "Action failed." });
  }
});

// ==================== SERVER LISTEN & INITIALIZATION ====================

const PORT = Number(process.env.PORT) || 5000;

async function startServer() {
  try {
    const schemaPath = path.join(__dirname, 'schema.sql');
    try {
      const schema = await fs.readFile(schemaPath, 'utf8');
      await pool.query(schema);
      console.log('✅ Database schema initialized');
    } catch (schemaErr) {
      console.warn('⚠️ Could not run schema.sql (skipping if tables exist):', schemaErr.message);
    }

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('❌ Failed to initialize database:', err);
    await pool.end();
    process.exitCode = 1;
  }
}

startServer();