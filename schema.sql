-- 1. Create Products Table
CREATE TABLE IF NOT EXISTS products (
    id VARCHAR(50) PRIMARY KEY,
    barcode VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    cost DECIMAL(10,2) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    stock INT NOT NULL DEFAULT 0,
    expiry DATE,
    image TEXT
);

-- Ensure image_url column compatibility if referenced elsewhere
ALTER TABLE products ADD COLUMN IF NOT EXISTS image TEXT;

-- 2. Create Transactions Table
CREATE TABLE IF NOT EXISTS transactions (
    id VARCHAR(50) PRIMARY KEY,
    customer_name VARCHAR(255) DEFAULT 'Guest Customer',
    date_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    address TEXT NOT NULL,
    gcash_ref VARCHAR(255) DEFAULT 'SCREENSHOT_ATTACHED',
    payment_proof TEXT,
    total DECIMAL(10,2) NOT NULL,
    items JSONB NOT NULL,
    status VARCHAR(50) DEFAULT 'Pending'
);

-- Ensure transaction columns exist on existing database instances
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255) DEFAULT 'Guest Customer';
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS payment_proof TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Pending';
ALTER TABLE transactions ALTER COLUMN gcash_ref TYPE VARCHAR(255);

-- 3. Create Approved Admin Accounts Table
CREATE TABLE IF NOT EXISTS admin_accounts (
    id SERIAL PRIMARY KEY,
    fullname VARCHAR(100) NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Create Separate Table for Pending Admin Registration Requests
CREATE TABLE IF NOT EXISTS pending_admin_accounts (
    id SERIAL PRIMARY KEY,
    fullname VARCHAR(100) NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(100) NOT NULL,
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Seed Primary Admin Account (Gabriel / Gabriel123) into admin_accounts
INSERT INTO admin_accounts (fullname, username, password)
VALUES ('Primary Admin', 'Gabriel', 'Gabriel123')
ON CONFLICT (username) DO UPDATE SET password = 'Gabriel123';

-- 6. Seed Default Inventory Items
INSERT INTO products (id, barcode, name, category, cost, price, stock, expiry) VALUES
('p1', '4800016022014', 'Lucky Me! Pancit Canton', 'Instant Noodles', 13.00, 16.00, 40, '2027-02-15'),
('p2', '4800016055012', 'Century Tuna Flakes 180g', 'Canned Goods', 38.50, 46.00, 18, '2027-08-20'),
('p3', '4800092112345', 'San Mig Coffee 3-in-1', 'Beverages', 7.00, 9.00, 80, '2026-12-10')
ON CONFLICT (id) DO NOTHING;