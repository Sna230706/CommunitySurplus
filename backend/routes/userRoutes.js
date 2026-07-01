const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const {
  getDashboard,
  getProfile,
  updateProfile
} = require("../controllers/userController");

const router = express.Router();

router.get("/profile", authMiddleware, getProfile);
router.put("/profile", authMiddleware, updateProfile);
router.patch("/profile", authMiddleware, updateProfile);
router.get("/dashboard", authMiddleware, getDashboard);

module.exports = router;
