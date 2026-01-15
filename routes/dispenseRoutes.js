import express from "express";
import { protect, allowRoles } from "../middlewares/auth.js";
import Prescriptions from "../models/Prescriptions.js";
import OPD from "../models/OPD.js";
import Stock from "../models/Stock.js";
import Dispense from "../models/Dispense.js";
import mongoose from "mongoose";
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
  },
  {$sort: {id: -1}}
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

router.get("/preview/:opdId", protect, async (req, res) => {
  try {
    const opdId = Number(req.params.opdId);

    const prescriptions = await Prescriptions.find({ opd_id: opdId });

    if (!prescriptions.length) {
      return res.json({ success: true, data: [] });
    }

    // ✅ FORCE NUMBER TYPE
    const medicineIds = prescriptions
      .map(p => Number(p.medicine_id))
      .filter(id => !isNaN(id));

    const stockAgg = await Stock.aggregate([
      {
        $match: {
          medicine_id: { $in: medicineIds },
          units: { $gte: 1 }
        }
      },
      {
        $group: {
          _id: {
            medicine_id: "$medicine_id",
            item_name: "$item_name",
            brand: "$brand",
            per_unit_cost: "$per_unit_cost",
            expiry_date: "$expiry_date"
          },
          total_units: { $sum: "$units" },
          stock_ids: { $push: "$id"}
        }
      },
      {
        $project: {
          _id: 0,
          medicine_id: "$_id.medicine_id",
          item_name: "$_id.item_name",
          brand: "$_id.brand",
          per_unit_cost: "$_id.per_unit_cost",
          expiry_date: "$_id.expiry_date",
          total_units: 1,
          stock_ids: 1
        }
      },
      { $sort: { expiry_date: 1 } }
    ]);

    const result = prescriptions.map(p => {
      const mid = Number(p.medicine_id);

      return {
        prescription_id: p.id,
        medicine_id: mid,
        drug_name_and_dose: p.drug_name_and_dose,
        frequency: p.frequency,
        days: p.days,
        stock_options: stockAgg.filter(s => s.medicine_id === mid)
      };
    });

    res.status(200).json({
      success: true,
      data: result
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

// router.post("/fill-prescription", protect, async (req, res) => {
//   const session = await mongoose.startSession();
//   session.startTransaction();

//   try {
//     const {
//       opd_id,
//       dispensed_items, // [{ stock_ids, units }]
//       dispensed_to_worker_id
//     } = req.body;

//     const dispensed_by = {
//       role: req.user.role,
//       userId: req.user.userId
//     };

//     const finalItems = [];

//     // 🔁 Process each item
//     for (const item of dispensed_items) {
//       if (!item.stock_ids || item.stock_ids.length === 0) continue;

//       const stockId = item.stock_ids[0]; // FIFO: first one
//       const unitsToDispense = Number(item.units);

//       if (unitsToDispense <= 0) {
//         throw new Error("Invalid dispense quantity");
//       }

//       // 🔍 Fetch stock
//       const stock = await Stock.findOne({ id: stockId }).session(session);
//       if (!stock) throw new Error("Stock not found");

//       if (stock.units < unitsToDispense) {
//         throw new Error(
//           `Insufficient stock for ${stock.item_name}`
//         );
//       }

//       // ➖ Deduct units
//       stock.units -= unitsToDispense;
//       await stock.save({ session });

//       finalItems.push({
//         stock_id: stockId,
//         units: unitsToDispense
//       });
//     }

//     // 🧾 Create Dispense record
//     const dispense = new Dispense({
//       opd_id,
//       dispensed_items: finalItems,
//       dispensed_to_worker_id,
//       dispensed_by
//     });

//     await dispense.save({ session });

//     // ✅ Mark OPD as dispensed
//     await OPD.findOneAndUpdate(
//       { id: opd_id },
//       { medicine_dispensed: true },
//       { session }
//     );

//     await session.commitTransaction();
//     session.endSession();

//     res.status(201).json({
//       success: true,
//       message: "Medicines dispensed successfully",
//       dispense
//     });

//   } catch (err) {
//     await session.abortTransaction();
//     session.endSession();

//     res.status(500).json({
//       success: false,
//       message: err.message
//     });
//   }
// });

router.post("/fill-prescription", protect, async (req, res) => {
  try {
    const {
      opd_id,
      dispensed_items, // [{ stock_ids, units }]
      dispensed_to_worker_id
    } = req.body;

    const dispensed_by = {
      role: req.user.role,
      userId: req.user.userId
    };

    if (!dispensed_items || !dispensed_items.length) {
      return res.status(400).json({
        success: false,
        message: "No medicines provided for dispensing"
      });
    }

    const finalItems = [];

    // 🔁 Process each dispensed item
    for (const item of dispensed_items) {
      if (!item.stock_ids || !item.stock_ids.length) continue;

      const stockId = item.stock_ids[0]; // FIFO
      const unitsToDispense = Number(item.units);

      if (!unitsToDispense || unitsToDispense <= 0) {
        throw new Error("Invalid dispense quantity");
      }

      // 🔍 Fetch stock
      const stock = await Stock.findOne({ id: stockId });
      if (!stock) {
        throw new Error(`Stock not found (ID: ${stockId})`);
      }

      if (stock.units < unitsToDispense) {
        throw new Error(
          `Insufficient stock for ${stock.item_name}. Available: ${stock.units}`
        );
      }

      // ➖ Deduct units
      stock.units -= unitsToDispense;
      await stock.save();

      finalItems.push({
        stock_id: stockId,
        units: unitsToDispense
      });
    }

    if (!finalItems.length) {
      return res.status(400).json({
        success: false,
        message: "No valid medicines selected for dispense"
      });
    }

    // 🧾 Create Dispense record
    const dispense = await Dispense.create({
      opd_id,
      dispensed_items: finalItems,
      dispensed_to_worker_id,
      dispensed_by
    });

    // ✅ Mark OPD as dispensed
    await OPD.findOneAndUpdate(
      { id: opd_id },
      { medicine_dispensed: true }
    );

    res.status(201).json({
      success: true,
      message: "Medicines dispensed successfully",
      dispense
    });

  } catch (err) {
    console.error("Dispense error:", err);

    res.status(500).json({
      success: false,
      message: err.message
    });
  }
});


export default router;