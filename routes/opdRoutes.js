import express from "express";
import OPD from "../models/OPD.js";
import Worker from "../models/Worker.js";
import Doctor from "../models/Doctor.js";
import Prescription from "../models/Prescriptions.js";
import { protect, allowRoles } from "../middlewares/auth.js";

const router = express.Router();

router.get("/finished", protect, async (req, res) => {
  try {
    const opds = await OPD.aggregate([
      {
        $match: {
          status: "Finished"
        }
      },
      {
        $lookup: {
          from: "workers",
          localField: "worker_id",
          foreignField: "id",
          as: "worker"
        }
      },
      { $unwind: "$worker" },
      {
        $project: {
          id: 1,
          created_at: 1,
          presenting_complaint: 1,
          status: 1,
          case_dealt_by: 1,
          "worker.id": 1,
          "worker.name": 1,
          "worker.employee_id": 1,
          "worker.phone_no": 1,
          "worker.designation": 1,
          "worker.contractor_name": 1,
          "worker.aadhar_no": 1
        }
      },
      { $sort: { id: -1 } }
    ]);

    res.json(opds);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get("/for-consultation", protect, async (req, res) => {
  try {
    const opds = await OPD.aggregate([
      {
        $match: {
          status: "For Consultation"
        }
      },
      {
        $lookup: {
          from: "workers",
          localField: "worker_id",
          foreignField: "id",
          as: "worker"
        }
      },
      { $unwind: "$worker" },
      {
        $project: {
          id: 1,
          created_at: 1,
          presenting_complaint: 1,
          status: 1,
          case_dealt_by: 1,
          "worker.id": 1,
          "worker.name": 1,
          "worker.employee_id": 1,
          "worker.phone_no": 1,
          "worker.designation": 1,
          "worker.contractor_name": 1,
          "worker.aadhar_no": 1
        }
      },
      { $sort: { id: -1 } }
    ]);

    res.json(opds);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// opdRoutes.js
router.get("/suggestions", protect, async (req, res) => {
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


router.post("/add", protect, async (req, res) => {
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
