import express from "express";
import multer from "multer";
import xlsx from "xlsx";
import Medicines from "../models/Medicines.js";
import Counter from "../models/Counter.js";
import BUList from "../models/BUList.js";
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

router.put("/:id", protect, allowRoles("ADMIN"), async (req, res) => {
  const updated = await Medicines.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true }
  );
  res.json(updated);
});

router.delete("/:id", protect, allowRoles("ADMIN"), async (req, res) => {
  await Medicines.findByIdAndDelete(req.params.id);
  res.json({ message: "Deleted" });
});

router.put("/edit-by-id/:medicineId", protect, allowRoles("ADMIN"), async (req, res) => {
  try {
    const { medicineId } = req.params;
    const {
      drug_name_and_dose,
      category,
      sub_category,
      brands
    } = req.body;

    // 1️⃣ Update Medicines
    const updatedMedicine = await Medicines.findOneAndUpdate(
      { id: medicineId },
      {
        drug_name_and_dose: drug_name_and_dose.trim(),
        category,
        sub_category,
        brands
      },
      { new: true }
    );

    if (!updatedMedicine) {
      return res.status(404).json({ message: "Medicine not found" });
    }

    // 2️⃣ Sync BUList
    await BUList.findOneAndUpdate(
      { medicine_id: medicineId },
      {
        item_name: updatedMedicine.drug_name_and_dose,
        category: updatedMedicine.category,
        sub_category: updatedMedicine.sub_category,
        brands: updatedMedicine.brands
      }
    );

    res.json({ message: "Medicine & BUList updated", updatedMedicine });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Update failed" });
  }
});

router.get("/fab-search", async (req, res) => {

    try {

        const q =
            req.query.q?.trim();

        if (!q) {

            return res.json([]);
        }

        const medicines =
            await Medicines.find({

                drug_name_and_dose: {

                    $regex: q,

                    $options: "i"
                }

            })

            .limit(20);

        res.json(medicines);

    } catch (err) {

        console.error(err);

        res.status(500).json({
            message:
                "Search failed"
        });
    }
});

router.get("/search", protect, async (req, res) => {
  try {
    const { query } = req.query;

    if (!query) return res.json([]);

    // Get medicine_ids already in BUList
    const existingBUItems = await BUList.find({}, { medicine_id: 1 });
    const existingIds = existingBUItems.map(b => b.medicine_id);

    const medicines = await Medicines.find({
      drug_name_and_dose: { $regex: query, $options: "i" },
      id: { $nin: existingIds }
    }).limit(10);

    res.json(medicines);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Search failed" });
  }
});


export default router;
