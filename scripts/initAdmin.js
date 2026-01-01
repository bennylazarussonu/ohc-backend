import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import dotenv from "dotenv";

dotenv.config();

await mongoose.connect(process.env.MONGODB_URI);

const exists = await User.findOne({ userId: "admin" });
if (exists) {
  console.log("Admin already exists");
  process.exit();
}

// const hashed = await bcrypt.hash("admin$123", 10);

await User.create({
  userId: "admin",
  password: "admin$123",
  role: "ADMIN",
  active: true
});

console.log("Admin created");
process.exit();
