const { pool } = require("../db");
const { mapProduct } = require("./productController");

function productSelect() {
  return `
    SELECT
      p.id,
      p.product_name,
      p.description,
      p.category,
      p.\`condition\` AS product_condition,
      p.mrp,
      p.selling_price,
      p.quantity,
      p.image,
      p.location,
      p.contact_number,
      p.status,
      p.seller_id,
      u.name AS seller_name
    FROM wishlist w
    JOIN products p ON p.id = w.product_id
    LEFT JOIN users u ON u.id = p.seller_id
  `;
}

async function getWishlist(req, res, next) {
  try {
    const [rows] = await pool.query(
      `${productSelect()} WHERE w.user_id = ? ORDER BY w.id DESC`,
      [req.user.id]
    );

    return res.json({ products: rows.map(mapProduct) });
  } catch (error) {
    return next(error);
  }
}

async function addToWishlist(req, res, next) {
  try {
    const productId = req.body.product_id || req.body.productId || req.body.id;

    if (!productId) {
      return res.status(400).json({ message: "Product id is required." });
    }

    const [products] = await pool.query("SELECT id FROM products WHERE id = ?", [productId]);
    if (!products.length) {
      return res.status(404).json({ message: "Product not found." });
    }

    await pool.query(
      "INSERT IGNORE INTO wishlist (user_id, product_id) VALUES (?, ?)",
      [req.user.id, productId]
    );

    return res.status(201).json({ message: "Product added to wishlist." });
  } catch (error) {
    return next(error);
  }
}

async function removeFromWishlist(req, res, next) {
  try {
    const productId = req.params.id || req.body.product_id || req.body.productId;

    await pool.query(
      "DELETE FROM wishlist WHERE user_id = ? AND product_id = ?",
      [req.user.id, productId]
    );

    return res.json({ message: "Product removed from wishlist." });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  addToWishlist,
  getWishlist,
  removeFromWishlist
};
