-- 1. Create Products Table
CREATE TABLE IF NOT EXISTS products (
    id VARCHAR(50) PRIMARY KEY,
    barcode VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    cost DECIMAL(10,2) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    stock INT NOT NULL DEFAULT 0,
    expiry DATE NOT NULL
);

-- 2. Create Transactions Table
CREATE TABLE IF NOT EXISTS transactions (
    id VARCHAR(50) PRIMARY KEY,
    customer_name VARCHAR(255) DEFAULT 'Guest Customer',
    date_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    address TEXT NOT NULL,
    gcash_ref VARCHAR(255) DEFAULT 'SCREENSHOT_ATTACHED',
    payment_proof TEXT,
    total DECIMAL(10,2) NOT NULL,
    items JSONB NOT NULL
);

-- Ensure all table columns exist for existing databases
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255) DEFAULT 'Guest Customer';
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS payment_proof TEXT;
ALTER TABLE transactions ALTER COLUMN gcash_ref TYPE VARCHAR(255);

-- 3. Seed Default Inventory Items
INSERT INTO products (id, barcode, name, category, cost, price, stock, expiry) VALUES
('p1', '4800016022014', 'Lucky Me! Pancit Canton', 'Instant Noodles', 13.00, 16.00, 40, '2027-02-15'),
('p2', '4800016055012', 'Century Tuna Flakes 180g', 'Canned Goods', 38.50, 46.00, 18, '2027-08-20'),
('p3', '4800092112345', 'San Mig Coffee 3-in-1', 'Beverages', 7.00, 9.00, 80, '2026-12-10')
ON CONFLICT (id) DO NOTHING;