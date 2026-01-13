import express from "express";
import multer from "multer";
import xlsx from "xlsx";
import Medicines from "../models/Medicines.js";
import BUList from "../models/BUList.js";
import Counter from "../models/Counter.js";
import { protect, allowRoles } from "../middlewares/auth.js";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

router.post(
  "/bulk",
  protect,
  allowRoles("ADMIN", "DOCTOR"),
  upload.single("file"),
  async (req, res) => {
    try {
      const workbook = xlsx.readFile(req.file.path);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawData = xlsx.utils.sheet_to_json(sheet);

      const itemNames = rawData
        .map(r => r.item_name?.trim())
        .filter(Boolean);

      const medicines = await Medicines.find({
        drug_name_and_dose: { $in: itemNames }
      }).lean();

      const medicineMap = new Map();
      medicines.forEach(m => {
        medicineMap.set(m.drug_name_and_dose, m);
      });

      const unmatchedItems = [];   // ⭐ ADD THIS

      const buListData = rawData.map(row => {
        const itemName = row.item_name?.trim();
        const matchedMedicine = medicineMap.get(itemName);

        if (matchedMedicine) {
          return {
            item_name: itemName,
            medicine_id: matchedMedicine.id,
            category: matchedMedicine.category,
            sub_category: matchedMedicine.sub_category,
            brands: matchedMedicine.brands || []
          };
        }

        // ❌ Not matched
        unmatchedItems.push(itemName);

        return {
          item_name: itemName,
          category: row.category,
          sub_category: row.sub_category,
          brands: [
            row.brand1,
            row.brand2,
            row.brand3,
            row.brand4,
            row.brand5
          ].filter(Boolean)
        };
      });

      const counter = await Counter.findOneAndUpdate(
        { name: "bulist_id" },
        { $inc: { seq: buListData.length } },
        { new: true, upsert: true }
      );

      const startId = counter.seq - buListData.length + 1;

      const finalData = buListData.map((item, i) => ({
        ...item,
        id: startId + i
      }));

      await BUList.insertMany(finalData);

      res.json({
        message: "BUList bulk upload successful",
        total: finalData.length,
        matched: medicines.length,
        unmatched: unmatchedItems.length,
        unmatchedItems   // ⭐ RETURN THEM
      });

    } catch (err) {
      console.error("BUList bulk upload error:", err);
      res.status(400).json({ message: err.message });
    }
  }
);

router.get("/", protect, async (req, res) => {
  const list = await BUList.find().sort({ item_name: 1 });
  res.json(list);
});



export default router;
