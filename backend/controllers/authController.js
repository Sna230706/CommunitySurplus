const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { pool } = require("../db");
require("dotenv").config();

function publicUser(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    email: row.email
  };
}

function createToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name
    },
    process.env.JWT_SECRET || "community_surplus_dev_secret",
    { expiresIn: process.env.JWT_EXPIRES_IN || "1d" }
  );
}

async function register(req, res, next) {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Name, email, and password are required." });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters." });
    }

    const [existing] = await pool.query("SELECT id FROM users WHERE email = ?", [email]);
    if (existing.length) {
      return res.status(409).json({ message: "An account already exists for this email." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
      [name.trim(), email.trim().toLowerCase(), hashedPassword]
    );

    const user = {
      id: result.insertId,
      name: name.trim(),
      email: email.trim().toLowerCase()
    };

    return res.status(201).json({
      message: "User registered successfully.",
      token: createToken(user),
      user
    });
  } catch (error) {
    return next(error);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const [rows] = await pool.query("SELECT * FROM users WHERE email = ?", [email.trim().toLowerCase()]);
    const user = rows[0];

    if (!user) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const safeUser = publicUser(user);

    return res.json({
      message: "Login successful.",
      token: createToken(safeUser),
      user: safeUser
    });
  } catch (error) {
    return next(error);
  }
}

async function me(req, res, next) {
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

module.exports = {
  register,
  login,
  me,
  publicUser
};
