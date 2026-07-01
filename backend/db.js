const mysql = require("mysql2/promise");
require("dotenv").config();

const dbName = process.env.DB_NAME || "communitysurplus";

const baseConfig = {
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "23072006",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

const pool = mysql.createPool({
  ...baseConfig,
  database: dbName
});

function escapeDatabaseName(name) {
  return String(name).replace(/`/g, "``");
}

async function ensureColumn(tableName, columnName, columnDefinition) {
  const [[column]] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [dbName, tableName, columnName]
  );

  if (Number(column.total) === 0) {
    await pool.query(`ALTER TABLE \`${tableName}\` ADD COLUMN ${columnDefinition}`);
  }
}

async function ensureDatabase() {
  const connection = await mysql.createConnection(baseConfig);
  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${escapeDatabaseName(dbName)}\``);
  await connection.end();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id INT AUTO_INCREMENT PRIMARY KEY,
      product_name VARCHAR(150) NOT NULL,
      description TEXT NOT NULL,
      category VARCHAR(80) NOT NULL,
      \`condition\` VARCHAR(60) NOT NULL,
      mrp DECIMAL(10, 2) DEFAULT 0,
      selling_price DECIMAL(10, 2) NOT NULL,
      quantity INT NOT NULL DEFAULT 1,
      image VARCHAR(255),
      location VARCHAR(150) NOT NULL,
      contact_number VARCHAR(30) NOT NULL,
      status VARCHAR(30) DEFAULT 'Available',
      seller_id INT NOT NULL,
      CONSTRAINT fk_products_seller FOREIGN KEY (seller_id)
        REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS wishlist (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      product_id INT NOT NULL,
      UNIQUE KEY unique_wishlist_item (user_id, product_id),
      CONSTRAINT fk_wishlist_user FOREIGN KEY (user_id)
        REFERENCES users(id) ON DELETE CASCADE,
      CONSTRAINT fk_wishlist_product FOREIGN KEY (product_id)
        REFERENCES products(id) ON DELETE CASCADE
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS confirmed_purchases (
      id INT AUTO_INCREMENT PRIMARY KEY,
      buyer_id INT,
      product_id INT NOT NULL,
      quantity INT NOT NULL DEFAULT 1,
      unit_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
      total_price DECIMAL(10, 2) NOT NULL DEFAULT 0,
      purchase_date DATE NOT NULL DEFAULT (CURRENT_DATE),
      CONSTRAINT fk_purchase_buyer FOREIGN KEY (buyer_id)
        REFERENCES users(id) ON DELETE SET NULL,
      CONSTRAINT fk_purchase_product FOREIGN KEY (product_id)
        REFERENCES products(id) ON DELETE CASCADE
    )
  `);

  await ensureColumn("products", "quantity", "quantity INT NOT NULL DEFAULT 1 AFTER selling_price");
  await ensureColumn("confirmed_purchases", "quantity", "quantity INT NOT NULL DEFAULT 1 AFTER product_id");
  await ensureColumn("confirmed_purchases", "unit_price", "unit_price DECIMAL(10, 2) NOT NULL DEFAULT 0 AFTER quantity");
  await ensureColumn("confirmed_purchases", "total_price", "total_price DECIMAL(10, 2) NOT NULL DEFAULT 0 AFTER unit_price");
}

module.exports = {
  pool,
  ensureDatabase
};
