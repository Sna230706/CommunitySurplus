const { pool } = require("../db");

function mapProduct(row) {
  const unitPrice = Number(row.selling_price || 0);
  const quantity = Number(row.quantity || 0);

  return {
    id: row.id,
    product_name: row.product_name,
    productName: row.product_name,
    description: row.description,
    category: row.category,
    condition: row.product_condition,
    mrp: Number(row.mrp || 0),
    selling_price: unitPrice,
    sellingPrice: unitPrice,
    unitPrice,
    quantity,
    availableQuantity: quantity,
    image: row.image || "",
    location: row.location,
    contact_number: row.contact_number,
    contactNumber: row.contact_number,
    status: row.status,
    seller_id: row.seller_id,
    sellerId: row.seller_id,
    sellerName: row.seller_name || "Community Seller"
  };
}

function uploadedImagePath(req) {
  if (!req.file) {
    return null;
  }

  return `/uploads/${req.file.filename}`;
}

function readQuantity(body, fallback) {
  const value = body.quantity ?? body.available_quantity ?? body.availableQuantity ?? fallback;
  const quantity = Number(value);

  return Number.isInteger(quantity) ? quantity : NaN;
}

function readMoney(value) {
  if (value === undefined || value === null || value === "") {
    return NaN;
  }

  const amount = Number(value);
  return Number.isFinite(amount) ? amount : NaN;
}

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
    FROM products p
    LEFT JOIN users u ON u.id = p.seller_id
  `;
}

async function getAllProducts(req, res, next) {
  try {
    const { q, category, condition, status, sellerId } = req.query;
    const clauses = [];
    const params = [];

    if (q) {
      clauses.push("(p.product_name LIKE ? OR p.description LIKE ? OR p.location LIKE ? OR u.name LIKE ?)");
      const like = `%${q}%`;
      params.push(like, like, like, like);
    }

    if (category) {
      clauses.push("p.category = ?");
      params.push(category);
    }

    if (condition) {
      clauses.push("p.`condition` = ?");
      params.push(condition);
    }

    if (status) {
      clauses.push("p.status = ?");
      params.push(status);
    }

    if (sellerId) {
      clauses.push("p.seller_id = ?");
      params.push(sellerId);
    }

    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const [rows] = await pool.query(`${productSelect()} ${where} ORDER BY p.id DESC`, params);

    return res.json({ products: rows.map(mapProduct) });
  } catch (error) {
    return next(error);
  }
}

async function getProductById(req, res, next) {
  try {
    const [rows] = await pool.query(`${productSelect()} WHERE p.id = ?`, [req.params.id]);

    if (!rows.length) {
      return res.status(404).json({ message: "Product not found." });
    }

    return res.json({ product: mapProduct(rows[0]) });
  } catch (error) {
    return next(error);
  }
}

async function getMyProducts(req, res, next) {
  try {
    const [rows] = await pool.query(
      `${productSelect()} WHERE p.seller_id = ? ORDER BY p.id DESC`,
      [req.user.id]
    );

    return res.json({ products: rows.map(mapProduct) });
  } catch (error) {
    return next(error);
  }
}

async function addProduct(req, res, next) {
  try {
    const {
      product_name,
      productName,
      description,
      category,
      condition,
      mrp,
      selling_price,
      sellingPrice,
      quantity: bodyQuantity,
      available_quantity,
      availableQuantity,
      location,
      contact_number,
      contactNumber
    } = req.body;

    const name = product_name || productName;
    const unitPrice = readMoney(selling_price ?? sellingPrice);
    const listMrp = mrp === undefined || mrp === null || mrp === "" ? 0 : readMoney(mrp);
    const contact = contact_number || contactNumber;
    const quantity = readQuantity({ quantity: bodyQuantity, available_quantity, availableQuantity }, 1);
    const image = uploadedImagePath(req) || req.body.image || "";

    if (!name || !description || !category || !condition || !location || !contact) {
      return res.status(400).json({ message: "Missing required product fields." });
    }

    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      return res.status(400).json({ message: "Unit selling price must be 0 or more." });
    }

    if (!Number.isFinite(listMrp) || listMrp < 0) {
      return res.status(400).json({ message: "MRP must be 0 or more." });
    }

    if (!Number.isInteger(quantity) || quantity < 1) {
      return res.status(400).json({ message: "Quantity must be a whole number of at least 1." });
    }

    const [result] = await pool.query(
      `INSERT INTO products
        (product_name, description, category, \`condition\`, mrp, selling_price, quantity, image, location, contact_number, seller_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name.trim(),
        description.trim(),
        category,
        condition,
        listMrp,
        unitPrice,
        quantity,
        image,
        location.trim(),
        contact.trim(),
        req.user.id
      ]
    );

    const [rows] = await pool.query(`${productSelect()} WHERE p.id = ?`, [result.insertId]);
    return res.status(201).json({ message: "Product added successfully.", product: mapProduct(rows[0]) });
  } catch (error) {
    return next(error);
  }
}

async function editProduct(req, res, next) {
  try {
    const [existingRows] = await pool.query("SELECT * FROM products WHERE id = ?", [req.params.id]);
    const existing = existingRows[0];

    if (!existing) {
      return res.status(404).json({ message: "Product not found." });
    }

    if (existing.seller_id !== req.user.id) {
      return res.status(403).json({ message: "You can edit only your own products." });
    }

    const image = uploadedImagePath(req) || req.body.image || existing.image;
    const productName = req.body.product_name || req.body.productName || existing.product_name;
    const sellingPrice = readMoney(req.body.selling_price ?? req.body.sellingPrice ?? existing.selling_price);
    const mrp = readMoney(req.body.mrp ?? existing.mrp ?? 0);
    const contactNumber = req.body.contact_number || req.body.contactNumber || existing.contact_number;
    const quantity = readQuantity(req.body, Number(existing.quantity || 0));

    if (!Number.isFinite(sellingPrice) || sellingPrice < 0) {
      return res.status(400).json({ message: "Unit selling price must be 0 or more." });
    }

    if (!Number.isFinite(mrp) || mrp < 0) {
      return res.status(400).json({ message: "MRP must be 0 or more." });
    }

    if (!Number.isInteger(quantity) || quantity < 0) {
      return res.status(400).json({ message: "Quantity must be a whole number of 0 or more." });
    }

    const status = quantity === 0 ? "Sold" : req.body.status || existing.status;

    await pool.query(
      `UPDATE products SET
        product_name = ?,
        description = ?,
        category = ?,
        \`condition\` = ?,
        mrp = ?,
        selling_price = ?,
        quantity = ?,
        image = ?,
        location = ?,
        contact_number = ?,
        status = ?
       WHERE id = ?`,
      [
        productName,
        req.body.description || existing.description,
        req.body.category || existing.category,
        req.body.condition || existing.condition,
        mrp,
        sellingPrice,
        quantity,
        image,
        req.body.location || existing.location,
        contactNumber,
        status,
        req.params.id
      ]
    );

    const [rows] = await pool.query(`${productSelect()} WHERE p.id = ?`, [req.params.id]);
    return res.json({ message: "Product updated successfully.", product: mapProduct(rows[0]) });
  } catch (error) {
    return next(error);
  }
}

async function deleteProduct(req, res, next) {
  try {
    const [rows] = await pool.query("SELECT seller_id FROM products WHERE id = ?", [req.params.id]);
    const product = rows[0];

    if (!product) {
      return res.status(404).json({ message: "Product not found." });
    }

    if (product.seller_id !== req.user.id) {
      return res.status(403).json({ message: "You can delete only your own products." });
    }

    await pool.query("DELETE FROM products WHERE id = ?", [req.params.id]);
    return res.json({ message: "Product deleted successfully." });
  } catch (error) {
    return next(error);
  }
}

async function confirmPurchase(req, res, next) {
  let connection;

  try {
    const productId = req.params.id || req.body.product_id || req.body.productId;
    const quantity = readQuantity(req.body, 1);

    if (!productId) {
      return res.status(400).json({ message: "Product id is required." });
    }

    if (!Number.isInteger(quantity) || quantity < 1) {
      return res.status(400).json({ message: "Quantity must be a whole number of at least 1." });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();

    const [rows] = await connection.query(
      "SELECT id, status, quantity, selling_price FROM products WHERE id = ? FOR UPDATE",
      [productId]
    );
    const product = rows[0];

    if (!product) {
      await connection.rollback();
      return res.status(404).json({ message: "Product not found." });
    }

    if (String(product.status).toLowerCase() === "sold" || Number(product.quantity || 0) < 1) {
      await connection.rollback();
      return res.status(409).json({ message: "This product is already sold." });
    }

    if (quantity > Number(product.quantity || 0)) {
      await connection.rollback();
      return res.status(409).json({ message: `Only ${product.quantity} item(s) are available.` });
    }

    const remainingQuantity = Number(product.quantity) - quantity;
    const nextStatus = remainingQuantity === 0 ? "Sold" : "Available";
    const unitPrice = Number(product.selling_price || 0);
    const totalPrice = unitPrice * quantity;

    await connection.query(
      "INSERT INTO confirmed_purchases (buyer_id, product_id, quantity, unit_price, total_price) VALUES (?, ?, ?, ?, ?)",
      [req.user.id, productId, quantity, unitPrice, totalPrice]
    );
    await connection.query(
      "UPDATE products SET quantity = ?, status = ? WHERE id = ?",
      [remainingQuantity, nextStatus, productId]
    );

    const [updatedRows] = await connection.query(`${productSelect()} WHERE p.id = ?`, [productId]);
    await connection.commit();

    return res.status(201).json({
      message: "Purchase confirmed successfully.",
      quantityPurchased: quantity,
      unitPrice,
      totalPrice,
      product: mapProduct(updatedRows[0])
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    return next(error);
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

module.exports = {
  addProduct,
  confirmPurchase,
  deleteProduct,
  editProduct,
  getAllProducts,
  getMyProducts,
  getProductById,
  mapProduct
};
