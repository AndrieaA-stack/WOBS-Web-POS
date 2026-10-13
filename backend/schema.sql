CREATE TABLE IF NOT EXISTS products (
    id VARCHAR(100) PRIMARY KEY,
    barcode VARCHAR(100) UNIQUE,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    cost NUMERIC(10, 2) DEFAULT 0.00,
    price NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    stock INTEGER NOT NULL DEFAULT 0,
    expiry DATE,
    image TEXT
);

CREATE TABLE IF NOT EXISTS transactions (
    id VARCHAR(100) PRIMARY KEY,
    customer_name VARCHAR(255) NOT NULL DEFAULT 'Guest Customer',
    address TEXT NOT NULL,
    gcash_ref VARCHAR(255) DEFAULT 'SCREENSHOT_ATTACHED',
    payment_proof TEXT,
    total NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    items JSONB NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Pending',
    date_created TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS admin_accounts (
    id SERIAL PRIMARY KEY,
    fullname VARCHAR(255) NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pending_admin_accounts (
    id SERIAL PRIMARY KEY,
    fullname VARCHAR(255) NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customers (
    id VARCHAR(100) PRIMARY KEY,
    fullname VARCHAR(255) NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    city VARCHAR(100),
    barangay VARCHAR(100),
    street TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS customer_id VARCHAR(100);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS customer_username VARCHAR(100);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT 'GCash';

CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date_created DESC);
CREATE INDEX IF NOT EXISTS idx_customers_username ON customers(LOWER(username));
CREATE INDEX IF NOT EXISTS idx_transactions_customer_username ON transactions(customer_username);

INSERT INTO admin_accounts (fullname, username, password)
VALUES ('Administrator', 'admin', 'password123')
ON CONFLICT (username) DO NOTHING;

INSERT INTO products (id, barcode, name, category, cost, price, stock, expiry, image)
VALUES
    ('p1', '4800016022014', 'Lucky Me! Pancit Canton', 'INSTANT NOODLES', 13.00, 16.00, 38, '2027-02-15', NULL),
    ('p2', '4800016055012', 'Century Tuna Flakes 180g', 'CANNED GOODS', 38.50, 46.00, 18, '2027-08-20', NULL),
    ('p3', '4800092112345', 'San Mig Coffee 3-in-1', 'BEVERAGES', 7.00, 9.00, 78, '2026-12-10', NULL)
ON CONFLICT (id) DO NOTHING;