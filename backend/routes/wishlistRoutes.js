const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const {
  addToWishlist,
  getWishlist,
  removeFromWishlist
} = require("../controllers/wishlistController");

const router = express.Router();

router.get("/wishlist", authMiddleware, getWishlist);
router.post("/wishlist", authMiddleware, addToWishlist);
router.post("/wishlist/add", authMiddleware, addToWishlist);
router.delete("/wishlist/:id", authMiddleware, removeFromWishlist);
router.delete("/wishlist/remove/:id", authMiddleware, removeFromWishlist);

module.exports = router;
