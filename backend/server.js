const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
app.use(cors());

// Configure body-parser to 50MB to accept Base64 payment proof image payloads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// PostgreSQL Pool Connection Configuration
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'wobs_db',
  password: 'gab', // Your PostgreSQL superuser password
  port: 5432,
});

// Test connection on startup
pool.connect((err, client, release) => {
  if (err) {
    return console.error('❌ Error connecting to PostgreSQL:', err.stack);
  }
  console.log(' Connected to PostgreSQL database: wobs_db');
  release();
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

// POST: Process atomic checkout transaction
app.post('/api/checkout', async (req, res) => {
  const { id, customerName, address, items, total, gcashRef, paymentProof } = req.body;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Insert transaction entry into transactions table
    const txnQuery = `
      INSERT INTO transactions (id, customer_name, address, gcash_ref, payment_proof, total, items)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `;
    await client.query(txnQuery, [
      id,
      customerName || 'Guest Customer',
      address, 
      gcashRef || 'SCREENSHOT_ATTACHED', 
      paymentProof || null, 
      total, 
      JSON.stringify(items)
    ]);

    // 2. Decrement inventory stock levels atomically
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
    console.log(`✅ Transaction saved for ${customerName}: ${id}`);
    res.status(200).json({ message: 'Order processed successfully', txnId: id });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("❌ Transaction Error:", err.message);
    res.status(500).json({ error: 'Database error: ' + err.message });
  } finally {
    client.release();
  }
});

// GET: Fetch completed transactions for Admin Portal
app.get('/api/transactions', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM transactions ORDER BY date_created DESC');
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching transactions:", err);
    res.status(500).json({ error: 'Failed to fetch transactions: ' + err.message });
  }
});

// POST: Add or Edit product entry
app.post('/api/products', async (req, res) => {
  const { id, barcode, name, category, cost, price, stock, expiry } = req.body;
  try {
    const query = `
      INSERT INTO products (id, barcode, name, category, cost, price, stock, expiry)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (id) DO UPDATE SET
        barcode = EXCLUDED.barcode,
        name = EXCLUDED.name,
        category = EXCLUDED.category,
        cost = EXCLUDED.cost,
        price = EXCLUDED.price,
        stock = EXCLUDED.stock,
        expiry = EXCLUDED.expiry
    `;
    await pool.query(query, [id, barcode, name, category, cost, price, stock, expiry]);
    res.json({ message: 'Product updated successfully' });
  } catch (err) {
    console.error("Error saving product:", err);
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

const PORT = 5000;
app.listen(PORT, () => {
  console.log(` WOBS PostgreSQL API running at http://localhost:${PORT}`);
});