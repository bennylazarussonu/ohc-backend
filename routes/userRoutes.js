import express from "express";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import { protect, allowRoles } from "../middlewares/auth.js";

const router = express.Router();

/**
 * GET all users (Admin only)
 */
router.get("/", protect, allowRoles("ADMIN"), async (req, res) => {
  try {
    const users = await User.find().select("-password").sort({ role: 1, userId: 1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch users" });
  }
});

/**
 * CREATE staff (EMPLOYEE) – Admin only
 */
router.post("/add-staff", protect, allowRoles("ADMIN"), async (req, res) => {
  try {
    const { userId, password } = req.body;

    if (!userId || !password) {
      return res.status(400).json({ message: "Username and password required" });
    }

    const exists = await User.findOne({ userId });
    if (exists) {
      return res.status(400).json({ message: "Username already exists" });
    }

    const user = new User({
      userId,
      password,
      role: "EMPLOYEE",
      active: true
    });

    await user.save();

    res.status(201).json({
      message: "Staff user created",
      userId: user.userId
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to create staff" });
  }
});


/**
 * RESET password (Admin only)
 */
router.put("/reset-password/:id", protect, allowRoles("ADMIN"), async (req, res) => {
  try {
    const { newPassword } = req.body;

    if (!newPassword) {
      return res.status(400).json({ message: "New password required" });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    user.password = newPassword;

    // const hashed = await bcrypt.hash(newPassword, 10);
    // user.password = hashed;
    await user.save();

    res.json({
      message: "Password reset successful",
      userId: user.userId
    });

  } catch (err) {
    res.status(500).json({ message: "Failed to reset password" });
  }
});

export default router;
