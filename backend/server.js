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

// Dynamic primary key column map for updated database schema (ProductID, CustomerID, AdminID, PendingAdminID, TransactionID)
const DB_COLS = {
  products: { id: '"ProductID"' },
  customers: { id: '"CustomerID"' },
  admin_accounts: { id: '"AdminID"' },
  pending_admin_accounts: { id: '"PendingAdminID"' },
  transactions: { id: '"TransactionID"', productId: '"ProductID"', hasItems: false },
};

// Auto-detect exact column casing from database
async function detectDatabaseColumns() {
  try {
    const res = await pool.query(`
      SELECT table_name, column_name 
      FROM information_schema.columns 
      WHERE table_name IN ('products', 'customers', 'admin_accounts', 'pending_admin_accounts', 'transactions')
    `);
    
    for (const row of res.rows) {
      const t = row.table_name;
      const c = row.column_name;
      const cLower = c.toLowerCase();

      if (t === 'products' && (cLower === 'productid' || cLower === 'id')) {
        DB_COLS.products.id = `"${c}"`;
      }
      if (t === 'customers' && (cLower === 'customerid' || cLower === 'id')) {
        DB_COLS.customers.id = `"${c}"`;
      }
      if (t === 'admin_accounts' && (cLower === 'adminid' || cLower === 'id')) {
        DB_COLS.admin_accounts.id = `"${c}"`;
      }
      if (t === 'pending_admin_accounts' && (cLower === 'pendingadminid' || cLower === 'id')) {
        DB_COLS.pending_admin_accounts.id = `"${c}"`;
      }
      if (t === 'transactions') {
        if (cLower === 'transactionid' || cLower === 'id') {
          DB_COLS.transactions.id = `"${c}"`;
        }
        if (cLower === 'productid') {
          DB_COLS.transactions.productId = `"${c}"`;
        }
        if (cLower === 'items') {
          DB_COLS.transactions.hasItems = true;
        }
      }
    }
    console.log("🔍 Detected Database Column Mapping:", DB_COLS);
  } catch (err) {
    console.warn("⚠️ Column detection note (using standard mappings):", err.message);
  }
}

// Automatic Database Schema Migration & Verification
async function initDatabaseSchema() {
  try {
    console.log("🔄 Ensuring database schema and tables are initialized with updated column keys...");

    // 1. Ensure products table with ProductID
    await pool.query(`
      CREATE TABLE IF NOT EXISTS products (
        "ProductID" VARCHAR(100) PRIMARY KEY,
        barcode VARCHAR(100),
        name VARCHAR(255) NOT NULL,
        category VARCHAR(100),
        cost NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
        price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
        stock INTEGER NOT NULL DEFAULT 0,
        expiry DATE,
        image TEXT,
        image_url TEXT,
        date_added TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Ensure transactions table with TransactionID and ProductID fk
    await pool.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        "TransactionID" VARCHAR(100) PRIMARY KEY,
        "ProductID" VARCHAR(100) REFERENCES products("ProductID"),
        customer_id VARCHAR(100),
        customer_username VARCHAR(100),
        customer_name VARCHAR(150),
        address TEXT,
        gcash_ref VARCHAR(100),
        payment_proof TEXT,
        total NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
        items JSONB,
        status VARCHAR(50) DEFAULT 'Pending',
        payment_method VARCHAR(50) DEFAULT 'GCash',
        date_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 3. Ensure customers table with CustomerID
    await pool.query(`
      CREATE TABLE IF NOT EXISTS customers (
        "CustomerID" VARCHAR(100) PRIMARY KEY,
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

    // 4. Ensure admin_accounts table with AdminID
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admin_accounts (
        "AdminID" SERIAL PRIMARY KEY,
        fullname VARCHAR(150) NOT NULL,
        username VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        status VARCHAR(50) DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 5. Ensure pending_admin_accounts table with PendingAdminID
    await pool.query(`
      CREATE TABLE IF NOT EXISTS pending_admin_accounts (
        "PendingAdminID" SERIAL PRIMARY KEY,
        fullname VARCHAR(150) NOT NULL,
        username VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 6. Safe Column Renaming Migration (id -> ProductID, CustomerID, AdminID, PendingAdminID, TransactionID)
    await pool.query(`
      DO $$ 
      BEGIN 
        -- customers: id -> CustomerID
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='id') 
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND LOWER(column_name)='customerid') THEN
          ALTER TABLE customers RENAME COLUMN id TO "CustomerID";
        END IF;

        -- products: id -> ProductID
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='id') 
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND LOWER(column_name)='productid') THEN
          ALTER TABLE products RENAME COLUMN id TO "ProductID";
        END IF;

        -- transactions: id -> TransactionID
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='id') 
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND LOWER(column_name)='transactionid') THEN
          ALTER TABLE transactions RENAME COLUMN id TO "TransactionID";
        END IF;

        -- admin_accounts: id -> AdminID
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='admin_accounts' AND column_name='id') 
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='admin_accounts' AND LOWER(column_name)='adminid') THEN
          ALTER TABLE admin_accounts RENAME COLUMN id TO "AdminID";
        END IF;

        -- pending_admin_accounts: id -> PendingAdminID
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pending_admin_accounts' AND column_name='id') 
           AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pending_admin_accounts' AND LOWER(column_name)='pendingadminid') THEN
          ALTER TABLE pending_admin_accounts RENAME COLUMN id TO "PendingAdminID";
        END IF;

        -- transactions columns & ProductID foreign key
        ALTER TABLE transactions ADD COLUMN IF NOT EXISTS "ProductID" VARCHAR(100) REFERENCES products("ProductID");
        ALTER TABLE transactions ADD COLUMN IF NOT EXISTS customer_id VARCHAR(100);
        ALTER TABLE transactions ADD COLUMN IF NOT EXISTS customer_username VARCHAR(100);
        ALTER TABLE transactions ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT 'GCash';

        -- Allow items column to be nullable if present with older schema
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='items') THEN
          ALTER TABLE transactions ALTER COLUMN items DROP NOT NULL;
        END IF;
      END $$;
    `);

    // Detect actual column names after migration
    await detectDatabaseColumns();

    console.log("✅ Database schema verified & primary key columns updated successfully!");
  } catch (err) {
    console.error("⚠️ Database schema initialization note:", err.message);
    await detectDatabaseColumns();
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
    const rows = result.rows.map(row => {
      const pid = row.ProductID || row.productid || row.id;
      return {
        ...row,
        id: pid,
        ProductID: pid
      };
    });
    res.json(rows);
  } catch (err) {
    console.error("Error fetching products:", err);
    res.status(500).json({ error: 'Failed to fetch products: ' + err.message });
  }
});

// POST: Add or Edit product entry (UPSERT on conflict)
app.post('/api/products', async (req, res) => {
  const { id, ProductID, barcode, name, category, cost, price, stock, expiry, image } = req.body;
  const productId = ProductID || id || ('prod_' + Date.now());

  const formattedExpiry = (expiry && String(expiry).trim() !== '' && expiry !== 'null') ? expiry : null;
  const formattedImage = (image && String(image).trim() !== '' && image !== 'null') ? image : null;

  try {
    const pkCol = DB_COLS.products.id;
    const query = `
      INSERT INTO products (${pkCol}, barcode, name, category, cost, price, stock, expiry, image)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (${pkCol}) DO UPDATE SET
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
      productId,
      barcode,
      name,
      category,
      parseFloat(cost) || 0,
      parseFloat(price) || 0,
      parseInt(stock) || 0,
      formattedExpiry,
      formattedImage
    ]);

    res.json({ success: true, message: 'Product saved to database successfully', ProductID: productId, id: productId });
  } catch (err) {
    console.error("❌ POSTGRESQL ERROR:", err.message);
    res.status(500).json({ success: false, error: 'Failed to save product: ' + err.message });
  }
});

// DELETE: Remove product from database
app.delete('/api/products/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const pkCol = DB_COLS.products.id;
    await pool.query(`DELETE FROM products WHERE ${pkCol} = $1`, [id]);
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
    TransactionID,
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

  const txnId = TransactionID || id || ('WOBS-' + Math.floor(100000 + Math.random() * 900000));

  const isWalkin = address && (
    address.toLowerCase().includes('walk-in') || 
    address.toLowerCase().includes('in-store') ||
    address.toLowerCase().includes('cashier')
  );

  // Enforce mandatory GCash screenshot validation for all online customer delivery orders
  if (!isWalkin && (paymentMethod === 'GCash' || !paymentMethod)) {
    if (!paymentProof || typeof paymentProof !== 'string' || (!paymentProof.startsWith('data:image') && !paymentProof.startsWith('http'))) {
      return res.status(400).json({ error: 'A valid GCash payment receipt screenshot is strictly required for online customer orders.' });
    }
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const txnPkCol = DB_COLS.transactions.id;
    const txnProdCol = DB_COLS.transactions.productId || '"ProductID"';
    const prodPkCol = DB_COLS.products.id;

    const primaryProductId = req.body.ProductID || req.body.productId || (items && items[0] ? (items[0].ProductID || items[0].id) : null);

    const cols = [txnPkCol, txnProdCol, 'customer_id', 'customer_username', 'customer_name', 'address', 'gcash_ref', 'payment_proof', 'total', 'status', 'payment_method'];
    const vals = [
      txnId,
      primaryProductId || null,
      customerId || null,
      customerUsername || null,
      customerName || 'Customer',
      address || 'In-Store POS / Walk-in',
      gcashRef || 'SCREENSHOT_ATTACHED',
      paymentProof || null,
      parseFloat(total) || 0,
      status || 'Pending',
      paymentMethod || 'GCash'
    ];

    if (DB_COLS.transactions.hasItems) {
      cols.push('items');
      vals.push(JSON.stringify(items || []));
    }

    const placeholders = vals.map((_, i) => `$${i + 1}`).join(', ');
    const txnQuery = `
      INSERT INTO transactions (${cols.join(', ')})
      VALUES (${placeholders})
    `;
    await client.query(txnQuery, vals);

    for (const item of items) {
      const itemId = item.id || item.ProductID;
      const updateStockQuery = `
        UPDATE products 
        SET stock = stock - $1 
        WHERE ${prodPkCol} = $2 AND stock >= $1
      `;
      const result = await client.query(updateStockQuery, [item.qty, itemId]);
      if (result.rowCount === 0) {
        throw new Error(`Insufficient stock or item not found for ID: ${itemId}`);
      }
    }

    await client.query('COMMIT');

    res.status(200).json({ message: 'Order processed successfully', txnId, id: txnId, TransactionID: txnId });
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
    const result = await pool.query(`
      SELECT t.*, p.name AS product_name 
      FROM transactions t 
      LEFT JOIN products p ON (t."ProductID" = p."ProductID" OR t."ProductID" = p.barcode)
      ORDER BY t.date_created DESC
    `);
    const rows = result.rows.map(row => {
      const tid = row.TransactionID || row.transactionid || row.id;
      const pid = row.ProductID || row.productid;
      let items = row.items;
      if (typeof items === 'string') {
        try { items = JSON.parse(items); } catch (_) { items = []; }
      }
      if (!items || (Array.isArray(items) && items.length === 0)) {
        if (pid) {
          items = [{
            id: pid,
            ProductID: pid,
            name: row.product_name || `Product (${pid})`,
            qty: 1,
            price: parseFloat(row.total || 0)
          }];
        } else {
          items = [];
        }
      }
      return {
        ...row,
        id: tid,
        TransactionID: tid,
        ProductID: pid,
        items
      };
    });
    res.json(rows);
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
  const txnPkCol = DB_COLS.transactions.id;

  try {
    const query = `
      UPDATE transactions 
      SET status = $1 
      WHERE ${txnPkCol} LIKE $2 OR ${txnPkCol} = $3
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
  const { fullname, username, password, phone, city, barangay, street, gpsDistance } = req.body;
  if (!fullname || !username || !password) {
    return res.status(400).json({ success: false, message: "Full name, username, and password are required." });
  }

  // 15km Delivery Radius Restriction (Personal Rider Base: Pandayan, Meycauayan, Bulacan)
  const ALLOWED_CITIES_15KM = [
    "meycauayan",
    "marilao",
    "valenzuela",
    "obando",
    "bocaue",
    "santa maria",
    "balagtas"
  ];

  if (!city || !ALLOWED_CITIES_15KM.includes(city.trim().toLowerCase())) {
    return res.status(400).json({
      success: false,
      message: "Registration is restricted to addresses within a 15 km radius of Pandayan, Meycauayan, Bulacan (Personal Delivery Rider)."
    });
  }

  if (gpsDistance !== undefined && gpsDistance !== null && parseFloat(gpsDistance) > 15.0) {
    return res.status(400).json({
      success: false,
      message: `Your GPS distance is ${parseFloat(gpsDistance).toFixed(1)} km away. Personal delivery is only available within 15 km of Pandayan, Meycauayan.`
    });
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
    const custPkCol = DB_COLS.customers.id;

    await pool.query(
      `INSERT INTO customers (${custPkCol}, fullname, username, password, phone, city, barangay, street)
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
      CustomerID: customerId,
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

// POST: Customer Login (Fixed for updated CustomerID column key)
app.post('/api/customer/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: "Username and password required." });
  }

  try {
    const result = await pool.query(
      `SELECT * 
       FROM customers 
       WHERE LOWER(username) = LOWER($1) AND password = $2`,
      [username.trim(), password]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, message: "Invalid customer username or password." });
    }

    const row = result.rows[0];
    const customerId = row.CustomerID || row.customerid || row.id;
    const user = {
      id: customerId,
      CustomerID: customerId,
      fullname: row.fullname,
      username: row.username,
      phone: row.phone || '',
      city: row.city || '',
      barangay: row.barangay || '',
      street: row.street || ''
    };
    res.json({ success: true, message: "Welcome back!", user });
  } catch (err) {
    console.error("Customer login error:", err);
    res.status(500).json({ success: false, message: "Customer login failed: " + err.message });
  }
});

// GET: Fetch Customer's Orders History
app.get('/api/customer/orders/:username', async (req, res) => {
  const { username } = req.params;
  try {
    const result = await pool.query(
      `SELECT t.*, p.name AS product_name 
       FROM transactions t 
       LEFT JOIN products p ON (t."ProductID" = p."ProductID" OR t."ProductID" = p.barcode)
       WHERE LOWER(t.customer_username) = LOWER($1) 
       ORDER BY t.date_created DESC`,
      [username.trim()]
    );
    const rows = result.rows.map(row => {
      const tid = row.TransactionID || row.transactionid || row.id;
      const pid = row.ProductID || row.productid;
      let items = row.items;
      if (typeof items === 'string') {
        try { items = JSON.parse(items); } catch (_) { items = []; }
      }
      if (!items || (Array.isArray(items) && items.length === 0)) {
        if (pid) {
          items = [{
            id: pid,
            ProductID: pid,
            name: row.product_name || `Product (${pid})`,
            qty: 1,
            price: parseFloat(row.total || 0)
          }];
        } else {
          items = [];
        }
      }
      return {
        ...row,
        id: tid,
        TransactionID: tid,
        ProductID: pid,
        items
      };
    });
    res.json(rows);
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

    const row = result.rows[0];
    const adminId = row.AdminID || row.adminid || row.id;
    res.json({
      success: true,
      user: {
        id: adminId,
        AdminID: adminId,
        username: row.username,
        fullname: row.fullname
      }
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ success: false, message: "Database connection failed: " + err.message });
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
    res.status(500).json({ success: false, message: "Failed to submit request: " + err.message });
  }
});

// GET: Fetch Pending Admin Requests
app.get('/api/admin/pending', async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM pending_admin_accounts ORDER BY requested_at ASC`);
    const rows = result.rows.map(row => {
      const pid = row.PendingAdminID || row.pendingadminid || row.id;
      return {
        ...row,
        id: pid,
        PendingAdminID: pid
      };
    });
    res.json(rows);
  } catch (err) {
    console.error("Fetch pending error:", err);
    res.status(500).json({ error: "Failed to fetch pending requests: " + err.message });
  }
});

// PUT: Approve or Reject Admin Account
app.put('/api/admin/approve/:id', async (req, res) => {
  const { id } = req.params;
  const { action } = req.body;
  const pendingPkCol = DB_COLS.pending_admin_accounts.id;

  try {
    if (action === 'APPROVED') {
      const pendingRes = await pool.query(`SELECT * FROM pending_admin_accounts WHERE ${pendingPkCol} = $1`, [id]);
      if (pendingRes.rows.length === 0) {
        return res.status(404).json({ error: "Pending request not found." });
      }

      const pendingUser = pendingRes.rows[0];

      await pool.query(
        `INSERT INTO admin_accounts (fullname, username, password) VALUES ($1, $2, $3)`,
        [pendingUser.fullname, pendingUser.username, pendingUser.password]
      );

      await pool.query(`DELETE FROM pending_admin_accounts WHERE ${pendingPkCol} = $1`, [id]);
    } else {
      await pool.query(`DELETE FROM pending_admin_accounts WHERE ${pendingPkCol} = $1`, [id]);
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Approval error:", err);
    res.status(500).json({ error: "Action failed: " + err.message });
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
      console.log('✅ Database schema initialized from schema.sql');
    } catch (schemaErr) {
      console.warn('⚠️ Could not run schema.sql (skipping if tables exist):', schemaErr.message);
    }

    await initDatabaseSchema();

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