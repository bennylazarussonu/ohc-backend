import express from "express";
import OPD from "../models/OPD.js";
import Worker from "../models/Worker.js";
import Doctor from "../models/Doctor.js";
import Prescription from "../models/Prescriptions.js";
import { protect, allowRoles } from "../middlewares/auth.js";

const router = express.Router();

router.get("/", protect, allowRoles("ADMIN", "DOCTOR"), async (req, res) => {
  try {
    const opds = await OPD.find().sort({ id: 1 });
    res.json(opds);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// opdRoutes.js
router.get("/suggestions", protect, allowRoles("ADMIN", "DOCTOR"), async (req, res) => {
  try {
    const { type, q } = req.query; // type = complaint | diagnosis

    if (!q || !type) return res.json([]);

    const field =
      type === "complaint"
        ? "presenting_complaint"
        : "diagnosis";

    const results = await OPD.aggregate([
      {
        $match: {
          [field]: { $regex: q, $options: "i" }
        }
      },
      {
        $group: {
          _id: `$${field}`
        }
      },
      {
        $limit: 10
      }
    ]);

    res.json(results.map(r => r._id));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


router.post("/add", protect, allowRoles("ADMIN", "DOCTOR"), async (req, res) => {
  try {
    const { worker_id, treating_doctor_id } = req.body;

    const workerExists = await Worker.findOne({ id: worker_id });
    if (!workerExists) {
      return res.status(400).json({ message: "Invalid worker_id" });
    }

    if (treating_doctor_id) {
      const doctorExists = await Doctor.findOne({ id: treating_doctor_id });
      if (!doctorExists) {
        return res.status(400).json({ message: "Invalid treating_doctor_id" });
      }
    }

    const opd = new OPD(req.body);
    await opd.save();

    res.status(201).json(opd);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put("/:id", protect, allowRoles("ADMIN", "DOCTOR"), async (req, res) => {
  const opd = await OPD.findOneAndUpdate(
    { id: Number(req.params.id) },
    req.body,
    { new: true }
  );
  res.json(opd);
});

router.get("/:id/full", protect, allowRoles("ADMIN", "DOCTOR"), async (req, res) => {
  try {
    const opdId = Number(req.params.id);

    const opd = await OPD.findOne({ id: opdId });
    if (!opd) {
      return res.status(404).json({ message: "OPD not found" });
    }

    const prescriptions = await Prescription.find({ opd_id: opdId });

    res.json({
      opd,
      prescriptions
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


export default router;
