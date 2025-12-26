import express from "express";
import Doctor from "../models/Doctor.js";
import Counter from "../models/Counter.js";
import { protect, allowRoles } from "../middlewares/auth.js";
import User from "../models/User.js";
import bcrypt from "bcryptjs";

const router = express.Router();

function generateUsername(name) {
  if (!name) return "";

  let cleaned = name
    .toLowerCase()
    .trim()
    // remove leading dr / dr. / doctor
    .replace(/^(dr\.?|doctor)\s+/i, "")
    // remove extra spaces
    .replace(/\s+/g, " ");

  // take first word as username
  return cleaned.split(" ")[0];
}


async function ensureUniqueUserId(baseUserId) {
  let userId = baseUserId;
  let counter = 1;

  while (await User.findOne({ userId })) {
    userId = `${baseUserId}${counter}`;
    counter++;
  }

  return userId;
}


/**
 * GET all doctors
 */
router.get("/", protect, allowRoles("ADMIN", "DOCTOR"), async (req, res) => {
  try {
    const doctors = await Doctor.find().sort({ name: 1 });
    res.json(doctors);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * ADD new doctor
 */
router.post("/add", protect, allowRoles("ADMIN"), async (req, res) => {
  try {
    const { name, qualification, designation, regn_no } = req.body;

    if (!name || !regn_no) {
      return res.status(400).json({ message: "Name and Registration No are required" });
    }

    // 1️⃣ Prevent duplicate doctor
    const exists = await Doctor.findOne({ regn_no });
    if (exists) {
      return res.status(400).json({ message: "Doctor with this registration already exists" });
    }

    // 2️⃣ Create Doctor
    const doctor = new Doctor({
      name,
      qualification,
      designation,
      regn_no
    });

    await doctor.save();

    // 3️⃣ Create User for Doctor
    const baseUserId = generateUsername(name);
    const userId = await ensureUniqueUserId(baseUserId);

    const user = new User({
      userId,
      password: 'doctor$123',
      role: "DOCTOR",
      active: true
    });

    await user.save();

    res.status(201).json({
      message: "Doctor & login created successfully",
      doctor,
      credentials: {
        userId,
        password: "doctor$123"
      }
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});


export default router;
