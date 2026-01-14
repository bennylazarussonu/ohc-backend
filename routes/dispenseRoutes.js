import express from "express";
import { protect, allowRoles } from "../middlewares/auth.js";
import Prescriptions from "../models/Prescriptions.js";
import OPD from "../models/OPD.js";
import Worker from "../models/Worker.js";

const router = express.Router();

router.get("/opds", protect, async (req, res) => {
    try {
    const data = await OPD.aggregate([
  {
    $match: { medicine_dispensed: false }
  },

  {
    $lookup: {
      from: "prescriptions",
      localField: "id",
      foreignField: "opd_id",
      as: "prescriptions"
    }
  },

  // 🔥 THIS IS THE IMPORTANT PART
  {
    $match: {
      "prescriptions.0": { $exists: true }
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

  {
    $unwind: "$worker"
  },

  {
    $project: {
      _id: 0,
      id: 1,
      worker_id: 1,
      presenting_complaint: 1,
      diagnosis: 1,
      created_at: 1,
      medicine_dispensed: 1,
      treating_doctor_id: 1,

      worker: {
            id: "$worker.id",
            name: "$worker.name",
            employee_id: "$worker.employee_id",
            aadhar_no: "$worker.aadhar_no",
            dob: "$worker.dob",
            gender: "$worker.gender",
            contractor_name: "$worker.contractor_name",
            date_of_joining: "$worker.date_of_joining",
            identification_marks: "$worker.identification_marks",
            phone_no: "$worker.phone_no",
            designation: "$worker.designation"
          },

      prescriptions: 1
    }
  }
]);


    res.status(200).json({
      success: true,
      count: data.length,
      data
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
})

export default router;