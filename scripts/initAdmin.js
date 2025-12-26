import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import User from "../models/User.js";

async function initAdmin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    // const exists = await User.findOne({ role: "ADMIN" });
    // if (exists) {
    //   console.log("Admin already exists");
    //   process.exit();
    // }

    await User.create({
      userId: "employee",
      password: "employee$123",
      role: "EMPLOYEE"
    });

    console.log("Admin created successfully");
    process.exit();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

initAdmin();
