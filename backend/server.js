const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const { ensureDatabase, pool } = require("./db");
const authRoutes = require("./routes/authRoutes");
const productRoutes = require("./routes/productRoutes");
const wishlistRoutes = require("./routes/wishlistRoutes");
const userRoutes = require("./routes/userRoutes");

const app = express();
const PORT = Number(process.env.PORT || 5001);

const corsOrigin = process.env.CORS_ORIGIN || "*";
app.use(cors({ origin: corsOrigin === "*" ? "*" : corsOrigin.split(",") }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/", (req, res) => {
  res.json({
    name: "Community Surplus API",
    status: "running",
    endpoints: ["/register", "/login", "/products", "/wishlist", "/profile", "/dashboard"]
  });
});

app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    return res.json({ status: "ok", database: "connected" });
  } catch (error) {
    return res.status(503).json({ status: "degraded", database: "not connected", error: error.message });
  }
});

app.use(authRoutes);
app.use("/api", authRoutes);
app.use("/api/auth", authRoutes);
app.use(productRoutes);
app.use("/api", productRoutes);
app.use(wishlistRoutes);
app.use("/api", wishlistRoutes);
app.use(userRoutes);
app.use("/api", userRoutes);
app.use("/api/users", userRoutes);

app.use((req, res) => {
  res.status(404).json({ message: "Route not found." });
});

app.use((error, req, res, next) => {
  const status = error.status || 500;
  res.status(status).json({
    message: error.message || "Something went wrong."
  });
});

async function startServer() {
  try {
    await ensureDatabase();
    console.log("MySQL database is ready.");
  } catch (error) {
    console.warn("MySQL database setup failed. Check backend/.env and ensure MySQL is running.");
    console.warn(error.message);
  }

  app.listen(PORT, () => {
    console.log(`Community Surplus API running at http://localhost:${PORT}`);
  });
}

startServer();
