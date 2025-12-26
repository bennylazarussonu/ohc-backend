import express from 'express';
import Prescription from '../models/Prescriptions.js';
import Worker from '../models/Worker.js';
import Medicines from '../models/Medicines.js';
import OPD from '../models/OPD.js';
import { protect, allowRoles } from '../middlewares/auth.js';

const router = express.Router();

router.get('/', protect, allowRoles("ADMIN", "DOCTOR"), async (req, res) => {
    try {
        const prescriptions = await Prescription.find().sort({ id: 1 });
        res.json(prescriptions);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

router.get('/by-opd/:opdId', protect, allowRoles("ADMIN", "DOCTOR"), async (req, res) => {
  try {
    const opd_id = Number(req.params.opdId);

    const prescriptions = await Prescription.find({ opd_id})
      .sort({ id: 1 });

    res.json(prescriptions);
  } catch (err) {
    console.error("Fetch prescription error:", err);
    res.status(500).json({ message: err.message });
  }
});

router.get("/prescription-template", protect, allowRoles("ADMIN", "DOCTOR"), async (req, res) => {
  try {
    const { type, value } = req.query;

    const field =
      type === "complaint"
        ? "presenting_complaint"
        : "diagnosis";

    // Find latest OPD with that value
    const opd = await OPD.findOne({ [field]: value })
      .sort({ created_at: -1 });

    if (!opd) return res.json([]);

    const prescriptions = await Prescription.find({
      opd_id: opd.id
    });

    res.json(prescriptions);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


router.post('/add', protect, allowRoles("ADMIN", "DOCTOR"), async (req, res) => {
    try {
    const prescriptions = req.body; // expect array of rows

    if (!Array.isArray(prescriptions) || prescriptions.length === 0) {
      return res.status(400).json({
        message: "Prescription data must be a non-empty array"
      });
    }

    // 🔍 Validate OPD & Worker (from first row)
    const { opd_id, worker_id } = prescriptions[0];

    const workerExists = await Worker.findOne({ id: worker_id });
    if (!workerExists) {
      return res.status(400).json({ message: "Invalid worker_id" });
    }

    const opdExists = await OPD.findOne({ id: opd_id });
    if (!opdExists) {
      return res.status(400).json({ message: "Invalid opd_id" });
    }

    // 🔍 Validate each prescription row
    for (const row of prescriptions) {
      if (
        row.opd_id !== opd_id ||
        row.worker_id !== worker_id
      ) {
        return res.status(400).json({
          message: "All prescription rows must have same opd_id and worker_id"
        });
      }

      const medicineExists = await Medicines.findOne({
        id: row.medicine_id
      });

      if (!medicineExists) {
        return res.status(400).json({
          message: `Invalid medicine_id: ${row.medicine_id}`
        });
      }
    }

    // ✅ Save prescriptions
    const savedPrescriptions = [];
    for (const row of prescriptions) {
      const prescription = new Prescription(row);
      await prescription.save();
      savedPrescriptions.push(prescription);
    }

    res.status(201).json({
      message: "Prescriptions saved successfully",
      count: savedPrescriptions.length,
      data: savedPrescriptions
    });
  } catch (err) {
    console.error("Prescription save error:", err);
    res.status(500).json({ message: err.message });
  }
});

export default router;