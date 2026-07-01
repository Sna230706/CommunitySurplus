const { pool } = require("../db");
const { publicUser } = require("./authController");

async function getProfile(req, res, next) {
  try {
    const [rows] = await pool.query(
      "SELECT id, name, email FROM users WHERE id = ?",
      [req.user.id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "User not found." });
    }

    return res.json({ user: publicUser(rows[0]) });
  } catch (error) {
    return next(error);
  }
}

async function updateProfile(req, res, next) {
  try {
    const { name, email } = req.body;

    if (!name || !email) {
      return res.status(400).json({ message: "Name and email are required." });
    }

    const [duplicate] = await pool.query(
      "SELECT id FROM users WHERE email = ? AND id <> ?",
      [email.trim().toLowerCase(), req.user.id]
    );

    if (duplicate.length) {
      return res.status(409).json({ message: "Another account already uses this email." });
    }

    await pool.query(
      "UPDATE users SET name = ?, email = ? WHERE id = ?",
      [
        name.trim(),
        email.trim().toLowerCase(),
        req.user.id
      ]
    );

    const [rows] = await pool.query(
      "SELECT id, name, email FROM users WHERE id = ?",
      [req.user.id]
    );

    return res.json({ message: "Profile updated successfully.", user: publicUser(rows[0]) });
  } catch (error) {
    return next(error);
  }
}

async function getDashboard(req, res, next) {
  try {
    const [[listingCount]] = await pool.query(
      "SELECT COUNT(*) AS total FROM products WHERE seller_id = ?",
      [req.user.id]
    );
    const [[wishlistCount]] = await pool.query(
      "SELECT COUNT(*) AS total FROM wishlist WHERE user_id = ?",
      [req.user.id]
    );
    const [[purchaseCount]] = await pool.query(
      "SELECT COALESCE(SUM(quantity), 0) AS total FROM confirmed_purchases WHERE buyer_id = ?",
      [req.user.id]
    );
    const [recentPurchases] = await pool.query(
      `SELECT
        cp.id,
        cp.product_id,
        cp.quantity,
        cp.unit_price,
        cp.total_price,
        cp.purchase_date,
        p.product_name,
        p.selling_price
       FROM confirmed_purchases cp
       JOIN products p ON p.id = cp.product_id
       WHERE cp.buyer_id = ?
       ORDER BY cp.purchase_date DESC, cp.id DESC
       LIMIT 4`,
      [req.user.id]
    );

    return res.json({
      listings: listingCount.total,
      wishlist: wishlistCount.total,
      purchases: purchaseCount.total,
      recentPurchases: recentPurchases.map((purchase) => ({
        id: purchase.id,
        productId: purchase.product_id,
        productName: purchase.product_name,
        price: Number(purchase.unit_price || purchase.selling_price || 0),
        unitPrice: Number(purchase.unit_price || purchase.selling_price || 0),
        totalPrice: Number(purchase.total_price || ((purchase.unit_price || purchase.selling_price || 0) * purchase.quantity)),
        quantity: Number(purchase.quantity || 1),
        purchaseDate: purchase.purchase_date
      }))
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getDashboard,
  getProfile,
  updateProfile
};
