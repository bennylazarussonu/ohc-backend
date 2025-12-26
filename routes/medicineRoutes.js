import express from "express";
import multer from "multer";
import xlsx from "xlsx";
import Medicines from "../models/Medicines.js";
import Counter from "../models/Counter.js";
import { allowRoles, protect } from "../middlewares/auth.js";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

router.get("/", protect, allowRoles("ADMIN", "DOCTOR", "EMPLOYEE"), async (req, res) => {
  try {
    const medicines = await Medicines.find().sort({ drug_name_and_dose: 1 });
    res.json(medicines);
  }catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post("/add", protect, allowRoles("ADMIN", "DOCTOR", "EMPLOYEE"), async (req, res) => {
  try {
    const {
      drug_name_and_dose,
      category,
      sub_category,
      brands,
      route_of_administration,
      frequency,
      frequency_description
    } = req.body;

    if (!drug_name_and_dose) {
      return res.status(400).json({ message: "Drug name is required" });
    }

    const medicine = new Medicines({
  drug_name_and_dose: drug_name_and_dose.trim(),
  category: category?.trim() || undefined,
  sub_category: sub_category?.trim() || undefined,
  brands: Array.isArray(brands) ? brands.filter(Boolean) : [],
  route_of_administration: route_of_administration || undefined,
  frequency: frequency || undefined,                     // ⭐ FIX
  frequency_description: frequency_description || undefined // ⭐ FIX
});


    await medicine.save();
    res.status(201).json(medicine);
  } catch (err) {
    console.error("Single medicine add error:", err);
    res.status(500).json({ message: err.message });
  }
});


router.post("/bulk", protect, allowRoles("ADMIN", "DOCTOR", "EMPLOYEE"), upload.single("file"), async (req, res) => {
  try {
    const workbook = xlsx.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawData = xlsx.utils.sheet_to_json(sheet);

    // Transform Excel rows → schema format
    const medicinesData = rawData.map((row) => ({
      drug_name_and_dose: row.drug_name_and_dose,
      category: row.category,
      sub_category: row.sub_category,
      brands: [
        row.brand1,
        row.brand2,
        row.brand3,
        row.brand4,
        row.brand5,
        row.brand6,
        row.brand7
      ].filter(Boolean),
      route_of_administration: row.route_of_administration,
      frequency: row.frequency?.trim(),
      frequency_description: row.frequency_description?.trim()
    }));

    // Reserve auto-increment IDs
    const counter = await Counter.findOneAndUpdate(
      { name: "medicines_id" },
      { $inc: { seq: medicinesData.length } },
      { new: true, upsert: true }
    );

    const startId = counter.seq - medicinesData.length + 1;

    const medicinesWithIds = medicinesData.map((m, i) => ({
      ...m,
      id: startId + i
    }));

    await Medicines.insertMany(medicinesWithIds);

    res.json({
      message: "Medicines bulk upload successful",
      count: medicinesWithIds.length
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
    console.error("Medicines bulk upload error:", err);
  }
});

export default router;
