const express = require("express");
const multer = require("multer");
const path = require("path");
const authMiddleware = require("../middleware/authMiddleware");
const {
  addProduct,
  confirmPurchase,
  deleteProduct,
  editProduct,
  getAllProducts,
  getMyProducts,
  getProductById
} = require("../controllers/productController");

const router = express.Router();
const uploadDir = path.join(__dirname, "..", "uploads");
const maxFileSize = Number(process.env.MAX_FILE_SIZE_MB || 5) * 1024 * 1024;

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, uploadDir);
  },
  filename(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = path.basename(file.originalname, ext).replace(/[^a-z0-9_-]/gi, "-").toLowerCase();
    cb(null, `${Date.now()}-${safeName}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: maxFileSize },
  fileFilter(req, file, cb) {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image uploads are allowed."));
    }

    return cb(null, true);
  }
});

router.get("/products/mine", authMiddleware, getMyProducts);
router.get("/products", getAllProducts);
router.get("/products/:id", getProductById);
router.post("/products", authMiddleware, upload.single("image"), addProduct);
router.put("/products/:id", authMiddleware, upload.single("image"), editProduct);
router.delete("/products/:id", authMiddleware, deleteProduct);
router.post("/products/:id/confirm", authMiddleware, confirmPurchase);

router.post("/add-product", authMiddleware, upload.single("image"), addProduct);
router.put("/edit-product/:id", authMiddleware, upload.single("image"), editProduct);
router.delete("/delete-product/:id", authMiddleware, deleteProduct);
router.post("/confirm-purchase", authMiddleware, confirmPurchase);

module.exports = router;
