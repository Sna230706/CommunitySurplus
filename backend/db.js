const mysql = require("mysql2/promise");
const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function readConnectionUrl() {
  const rawUrl = process.env.DATABASE_URL || process.env.MYSQL_URL;
  if (!rawUrl) {
    return {};
  }

  const url = new URL(rawUrl);
  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : undefined,
    user: decodeURIComponent(url.username || ""),
    password: decodeURIComponent(url.password || ""),
    database: url.pathname ? decodeURIComponent(url.pathname.replace(/^\//, "")) : undefined
  };
}

const urlConfig = readConnectionUrl();
const dbName = process.env.DB_NAME || urlConfig.database || "communitysurplus";

function isSslDisabled(value) {
  return ["0", "false", "off", "disable", "disabled"].includes(String(value || "").toLowerCase());
}

function buildSslConfig(host) {
  const sslMode = String(process.env.DB_SSL || "").toLowerCase();
  const shouldUseSsl = process.env.DB_SSL
    ? !isSslDisabled(process.env.DB_SSL)
    : Boolean(host && !LOCAL_HOSTS.has(host));

  if (!shouldUseSsl) {
    return undefined;
  }

  const caPath = process.env.DB_SSL_CA
    ? path.resolve(__dirname, process.env.DB_SSL_CA)
    : path.join(__dirname, "certs", "isrgrootx1.pem");
  const ssl = {
    rejectUnauthorized: sslMode !== "unverified"
  };

  if (fs.existsSync(caPath)) {
    ssl.ca = fs.readFileSync(caPath);
  } else if (process.env.DB_SSL_CA) {
    throw new Error(`DB_SSL_CA does not exist: ${caPath}`);
  }

  return ssl;
}

const baseConfig = {
  host: process.env.DB_HOST || urlConfig.host || "localhost",
  port: Number(process.env.DB_PORT || urlConfig.port || 3306),
  user: process.env.DB_USER || urlConfig.user || "root",
  password: process.env.DB_PASSWORD || urlConfig.password || "",
  waitForConnections: true,
  connectionLimit: 10,
  connectTimeout: Number(process.env.DB_CONNECT_TIMEOUT_MS || 10000),
  queueLimit: 0
};

baseConfig.ssl = buildSslConfig(baseConfig.host);

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
