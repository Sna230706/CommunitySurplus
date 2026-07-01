const jwt = require("jsonwebtoken");
require("dotenv").config();

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: "Authentication token is required." });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || "community_surplus_dev_secret");
    return next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token." });
  }
}

module.exports = authMiddleware;
