import express from "express";
import { protect, allowRoles } from "../middlewares/auth.js";
import Prescriptions from "../models/Prescriptions.js";
import OPD from "../models/OPD.js";
import Stock from "../models/Stock.js";
import Dispense from "../models/Dispense.js";
import mongoose from "mongoose";
import Worker from "../models/Worker.js";
import Medicines from "../models/Medicines.js";
import Procurement from "../models/Procurement.js";
import StockVerification from "../models/StockVerification.js";

const router = express.Router();

router.get("/opds", protect, async (req, res) => {
    try {
        const data = await OPD.aggregate([
            {
                $match: { medicine_dispensed: false },
            },

            {
                $lookup: {
                    from: "prescriptions",
                    localField: "id",
                    foreignField: "opd_id",
                    as: "prescriptions",
                },
            },

            // 🔥 THIS IS THE IMPORTANT PART
            {
                $match: {
                    "prescriptions.0": { $exists: true },
                },
            },

            {
                $lookup: {
                    from: "workers",
                    localField: "worker_id",
                    foreignField: "id",
                    as: "worker",
                },
            },

            {
                $unwind: "$worker",
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
                        designation: "$worker.designation",
                    },

                    prescriptions: 1,
                },
            },
            { $sort: { id: -1 } },
        ]);

        res.status(200).json({
            success: true,
            count: data.length,
            data,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
});

router.get("/preview/:opdId", protect, async (req, res) => {
    try {
        const opdId = Number(req.params.opdId);

        const prescriptions = await Prescriptions.find({ opd_id: opdId });

        if (!prescriptions.length) {
            return res.json({ success: true, data: [] });
        }

        // ✅ FORCE NUMBER TYPE
        const medicineIds = prescriptions
            .map((p) => Number(p.medicine_id))
            .filter((id) => !isNaN(id));

        const stockAgg = await Stock.aggregate([
            {
                $match: {
                    medicine_id: { $in: medicineIds },
                    units: { $gte: 1 },
                },
            },
            {
                $group: {
                    _id: {
                        medicine_id: "$medicine_id",
                        item_name: "$item_name",
                        brand: "$brand",
                        per_unit_cost: "$per_unit_cost",
                        expiry_date: "$expiry_date",
                    },
                    total_units: { $sum: "$units" },
                    stock_ids: { $push: "$id" },
                },
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
                    stock_ids: 1,
                },
            },
            { $sort: { expiry_date: 1 } },
        ]);

        const result = prescriptions.map((p) => {
            const mid = Number(p.medicine_id);

            return {
                prescription_id: p.id,
                medicine_id: mid,
                drug_name_and_dose: p.drug_name_and_dose,
                frequency: p.frequency,
                days: p.days,
                stock_options: stockAgg.filter((s) => s.medicine_id === mid),
            };
        });

        res.status(200).json({
            success: true,
            data: result,
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message,
        });
    }
});

//production
router.post("/fill-prescription", protect, async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const {
            opd_id,
            dispensed_items, // [{ stock_ids, units }]
            dispensed_to_worker_id,
        } = req.body;

        const dispensed_by = {
            role: req.user.role,
            userId: req.user.userId,
        };
        if (!dispensed_items || !dispensed_items.length) {
            await session.abortTransaction();
            session.endSession();

            return res.status(400).json({
                success: false,
                message: "No medicines provided for dispensing",
            });
        }

        const finalItems = [];

        // 🔁 Process each item
        for (const item of dispensed_items) {
            if (!item.stock_ids || item.stock_ids.length === 0) continue;

            const stockId = item.stock_ids[0]; // FIFO: first one
            const unitsToDispense = Number(item.units);

            if (!Number.isInteger(unitsToDispense)) {
                throw new Error("Units must be integer");
            }

            if (unitsToDispense <= 0) {
                throw new Error("Invalid dispense quantity");
            }

            // 🔍 Fetch stock
            const stock = await Stock.findOne({
                id: stockId,
            }).session(session);

            if (!stock) {
                throw new Error(`Stock ${stockId} not found`);
            }

            if (stock.units < unitsToDispense) {
                throw new Error(
                    `Insufficient stock for ${stock.item_name}. Available: ${stock.units}, Requested: ${unitsToDispense}`,
                );
            }

            // Expiry validation
            if (stock.expiry_date && stock.expiry_date < new Date()) {
                throw new Error(`${stock.item_name} batch has expired`);
            }

            // ➖ Deduct units
            stock.units -= unitsToDispense;
            await stock.save({ session });

            finalItems.push({
                stock_id: stockId,
                units: unitsToDispense,
            });
        }

        // 🧾 Create Dispense record
        const dispense = new Dispense({
            opd_id,
            dispensed_items: finalItems,
            dispensed_to_worker_id,
            dispensed_by,
        });

        await dispense.save({ session });

        // ✅ Mark OPD as dispensed
        if (opd_id) {
            await OPD.findOneAndUpdate(
                { id: opd_id },
                { medicine_dispensed: true },
                { session },
            );
        }

        await session.commitTransaction();
        session.endSession();

        res.status(201).json({
            success: true,
            message: "Medicines dispensed successfully",
            dispense,
        });
    } catch (err) {
        await session.abortTransaction();
        session.endSession();

        res.status(500).json({
            success: false,
            message: err.message,
        });
    }
});

router.get("/history", protect, async (req, res) => {
    try {
        const data = await Dispense.aggregate([
            {
                $lookup: {
                    from: "workers",
                    localField: "dispensed_to_worker_id",
                    foreignField: "id",
                    as: "worker",
                },
            },

            {
                $lookup: {
                    from: "stocks",
                    localField: "dispensed_items.stock_id",
                    foreignField: "id",
                    as: "stocks",
                },
            },

            {
                $addFields: {
                    stocks: {
                        $map: {
                            input: "$stocks",
                            as: "stock",
                            in: {
                                $mergeObjects: [
                                    "$$stock",
                                    {
                                        dispensed_units: {
                                            $sum: {
                                                $map: {
                                                    input: {
                                                        $filter: {
                                                            input: "$dispensed_items",
                                                            as: "item",
                                                            cond: {
                                                                $eq: [
                                                                    "$$item.stock_id",
                                                                    "$$stock.id",
                                                                ],
                                                            },
                                                        },
                                                    },
                                                    as: "matched",
                                                    in: "$$matched.units",
                                                },
                                            },
                                        },
                                    },
                                ],
                            },
                        },
                    },
                },
            },

            {
                $sort: {
                    dispensed_on: -1,
                },
            },
        ]);

        res.status(200).json({
            success: true,
            data,
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message,
        });
    }
});

//local
// router.post("/fill-prescription", protect, async (req, res) => {
//     try {
//         const {
//             opd_id,
//             dispensed_items, // [{ stock_ids, units }]
//             dispensed_to_worker_id,
//         } = req.body;

//         const dispensed_by = {
//             role: req.user.role,
//             userId: req.user.userId,
//         };

//         if (!dispensed_items || !dispensed_items.length) {
//             return res.status(400).json({
//                 success: false,
//                 message: "No medicines provided for dispensing",
//             });
//         }

//         const finalItems = [];

//         // 🔁 Process each dispensed item
//         for (const item of dispensed_items) {
//             if (!item.stock_ids || !item.stock_ids.length) continue;

//             const stockId = item.stock_ids[0]; // FIFO
//             const unitsToDispense = Number(item.units);
//             if (!Number.isInteger(unitsToDispense)) {
//                 throw new Error("Units must be integer");
//             }

//             if (!unitsToDispense || unitsToDispense <= 0) {
//                 throw new Error("Invalid dispense quantity");
//             }

//             console.log({
//                 stockId,
//                 unitsToDispense,
//             });

//             const stockCheck = await Stock.findOne({
//                 id: stockId,
//             });

//             console.log("Stock found:", stockCheck);

//             // 🔍 Fetch stock
//             const updatedStock = await Stock.findOneAndUpdate(
//                 {
//                     id: stockId,
//                     units: { $gte: unitsToDispense },

//                     $or: [
//                         { expiry_date: null },
//                         { expiry_date: { $gte: new Date() } },
//                     ],
//                 },
//                 {
//                     $inc: {
//                         units: -unitsToDispense,
//                     },
//                 },
//                 {
//                     new: true,
//                 },
//             );

//             if (!updatedStock) {
//                 throw new Error(`Insufficient stock or stock not found`);
//             }

//             finalItems.push({
//                 stock_id: stockId,
//                 units: unitsToDispense,
//             });
//         }

//         if (!finalItems.length) {
//             return res.status(400).json({
//                 success: false,
//                 message: "No valid medicines selected for dispense",
//             });
//         }

//         // 🧾 Create Dispense record
//         const dispense = await Dispense.create({
//             opd_id,
//             dispensed_items: finalItems,
//             dispensed_to_worker_id,
//             dispensed_by,
//         });

//         // ✅ Mark OPD as dispensed
//         if (opd_id) {
//             await OPD.findOneAndUpdate(
//                 { id: opd_id },
//                 { medicine_dispensed: true },
//             );
//         }

//         res.status(201).json({
//             success: true,
//             message: "Medicines dispensed successfully",
//             dispense,
//         });
//     } catch (err) {
//         console.error("Dispense error:", err);

//         res.status(500).json({
//             success: false,
//             message: err.message,
//         });
//     }
// });

router.get("/workers/search", protect, async (req, res) => {
    try {
        const q = req.query.q || "";

        const workers = await Worker.find({
            $or: [
                { name: { $regex: q, $options: "i" } },
                { employee_id: { $regex: q, $options: "i" } },
                { fathers_name: { $regex: q, $options: "i" } },
            ],
        }).limit(20);

        res.json({
            success: true,
            data: workers,
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message,
        });
    }
});

router.get("/stock/search", protect, async (req, res) => {
    try {
        const q = req.query.q || "";

        const stocks = await Stock.find({
            units: { $gt: 0 },
            $or: [
                { item_name: { $regex: q, $options: "i" } },
                { brand: { $regex: q, $options: "i" } },
            ],
        })
            .sort({ expiry_date: 1 })
            .limit(30);

        res.json({
            success: true,
            data: stocks,
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message,
        });
    }
});

router.get("/balance-sheet", async (req, res) => {
    try {
        const { date } = req.query;

        if (!date) {
            return res.status(400).json({
                success: false,
                message: "date is required",
            });
        }

        const selectedDate = new Date(date);

        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);

        const procuredBefore = await Procurement.aggregate([
            {
                $match: {
                    procurement_date: {
                        $lt: selectedDate,
                    },
                },
            },

            {
                $unwind: "$items",
            },

            {
                $group: {
                    _id: "$items.medicine_id",
                    units: {
                        $sum: "$items.units",
                    },
                },
            },
        ]);

        const dispensedBefore = await Dispense.aggregate([
            {
                $match: {
                    // adjustment: { $ne: true },
                    dispensed_on: {
                        $lt: selectedDate,
                    },
                },
            },

            {
                $unwind: "$dispensed_items",
            },

            {
                $lookup: {
                    from: "stocks",
                    localField: "dispensed_items.stock_id",
                    foreignField: "id",
                    as: "stock",
                },
            },

            {
                $unwind: "$stock",
            },

            {
                $group: {
                    _id: "$stock.medicine_id",
                    units: {
                        $sum: "$dispensed_items.units",
                    },
                },
            },
        ]);

        const procuredBeforeMap = new Map(
            procuredBefore.map((item) => [item._id, item.units]),
        );

        const dispensedBeforeMap = new Map(
            dispensedBefore.map((item) => [item._id, item.units]),
        );

        const procuredDuring = await Procurement.aggregate([
            {
                $match: {
                    procurement_date: {
                        $gte: selectedDate,
                        $lt: nextDate,
                    },
                },
            },

            {
                $unwind: "$items",
            },

            {
                $group: {
                    _id: "$items.medicine_id",
                    units: {
                        $sum: "$items.units",
                    },
                },
            },
        ]);

        const dispensedDuring = await Dispense.aggregate([
            {
                $match: {
                    // adjustment: { $ne: true },
                    dispensed_on: {
                        $gte: selectedDate,
                        $lt: nextDate,
                    },
                },
            },

            {
                $unwind: "$dispensed_items",
            },

            {
                $lookup: {
                    from: "stocks",
                    localField: "dispensed_items.stock_id",
                    foreignField: "id",
                    as: "stock",
                },
            },

            {
                $unwind: "$stock",
            },

            {
                $group: {
                    _id: "$stock.medicine_id",
                    units: {
                        $sum: "$dispensed_items.units",
                    },
                },
            },
        ]);

        const procuredDuringMap = new Map(
            procuredDuring.map((item) => [item._id, item.units]),
        );

        const dispensedDuringMap = new Map(
            dispensedDuring.map((item) => [item._id, item.units]),
        );

        const medicineIds = new Set([
            ...procuredBefore.map((x) => x._id),
            ...dispensedBefore.map((x) => x._id),
            ...procuredDuring.map((x) => x._id),
            ...dispensedDuring.map((x) => x._id),
        ]);

        const openingBalances = [];

        for (const medicineId of medicineIds) {
            const procured = procuredBeforeMap.get(medicineId) || 0;

            const dispensed = dispensedBeforeMap.get(medicineId) || 0;

            openingBalances.push({
                medicine_id: medicineId,

                opening_units: procured - dispensed,

                procured_units: procuredDuringMap.get(medicineId) || 0,

                dispensed_units: dispensedDuringMap.get(medicineId) || 0,
            });
        }

        const medicineIdsArray = openingBalances.map(
            (item) => item.medicine_id,
        );

        const medicines = await Medicines.find({
            id: { $in: medicineIdsArray },
        });

        const medicineMap = new Map(
            medicines.map((m) => [m.id, m.drug_name_and_dose]),
        );

        const balanceSheet = openingBalances.map((item) => ({
            medicine_id: item.medicine_id,

            medicine_name: medicineMap.get(item.medicine_id) || "Unknown",

            opening_units: item.opening_units,

            procured_units: item.procured_units,

            dispensed_units: item.dispensed_units,

            closing_units:
                item.opening_units + item.procured_units - item.dispensed_units,
        }));

        res.status(200).json({
            success: true,
            data: balanceSheet,
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message,
        });
    }
});

router.get("/balance-sheet-range", async (req, res) => {
    try {
        const { from, to } = req.query;

        if (!from || !to) {
            return res.status(400).json({
                success: false,
                message: "from and to dates are required",
            });
        }

        if (new Date(from) > new Date(to)) {
            return res.status(400).json({
                success: false,
                message: "from date cannot be greater than to date",
            });
        }

        const dates = [];

        const toDate = new Date(to);
        const diffDays = (toDate - new Date(from)) / (1000 * 60 * 60 * 24);

        if (diffDays > 90) {
            return res.status(400).json({
                success: false,
                message: "Maximum range is 90 days",
            });
        }
        let current = new Date(from);

        while (current <= toDate) {
            dates.push(current.toISOString().split("T")[0]);
            current.setDate(current.getDate() + 1);
        }

        const startDate = new Date(`${from}T00:00:00.000Z`);
        const endDate = new Date(`${to}T23:59:59.999Z`);

        const procuredBefore = await Procurement.aggregate([
            {
                $match: {
                    procurement_date: {
                        $lt: startDate,
                    },
                },
            },
            {
                $unwind: "$items",
            },
            {
                $group: {
                    _id: "$items.medicine_id",
                    units: {
                        $sum: "$items.units",
                    },
                },
            },
        ]);

        const dispensedBefore = await Dispense.aggregate([
            {
                $match: {
                    dispensed_on: {
                        $lt: startDate,
                    },
                },
            },
            {
                $unwind: "$dispensed_items",
            },
            {
                $lookup: {
                    from: "stocks",
                    localField: "dispensed_items.stock_id",
                    foreignField: "id",
                    as: "stock",
                },
            },
            {
                $unwind: "$stock",
            },
            {
                $group: {
                    _id: "$stock.medicine_id",
                    units: {
                        $sum: "$dispensed_items.units",
                    },
                },
            },
        ]);

        const procuredDuring = await Procurement.aggregate([
            {
                $match: {
                    procurement_date: {
                        $gte: startDate,
                        $lte: endDate,
                    },
                },
            },
            {
                $unwind: "$items",
            },
            {
                $group: {
                    _id: "$items.medicine_id",
                    units: {
                        $sum: "$items.units",
                    },
                },
            },
        ]);

        const procuredBeforeMap = new Map(
            procuredBefore.map((x) => [x._id, x.units]),
        );

        const dispensedBeforeMap = new Map(
            dispensedBefore.map((x) => [x._id, x.units]),
        );

        const procuredDuringMap = new Map(
            procuredDuring.map((x) => [x._id, x.units]),
        );

        console.log("startDate", startDate);
        console.log("endDate", endDate);

        const count = await Dispense.countDocuments({
            dispensed_on: {
                $gte: startDate,
                $lte: endDate,
            },
        });

        console.log("count =", count);

        const dispenses = await Dispense.aggregate([
            {
                $match: {
                    dispensed_on: {
                        $gte: startDate,
                        $lte: endDate,
                    },
                },
            },

            {
                $unwind: "$dispensed_items",
            },

            {
                $lookup: {
                    from: "stocks",
                    localField: "dispensed_items.stock_id",
                    foreignField: "id",
                    as: "stock",
                },
            },

            {
                $unwind: "$stock",
            },

            {
                $project: {
                    medicine_id: "$stock.medicine_id",
                    units: "$dispensed_items.units",

                    date: {
                        $dateToString: {
                            format: "%Y-%m-%d",
                            date: "$dispensed_on",
                        },
                    },
                },
            },
        ]);

        const dispensedDuringMap = new Map();

        for (const record of dispenses) {
            dispensedDuringMap.set(
                record.medicine_id,
                (dispensedDuringMap.get(record.medicine_id) || 0) +
                    record.units,
            );
        }

        const medicineIds = [
            ...new Set([
                ...dispenses.map((x) => x.medicine_id),
                ...procuredBefore.map((x) => x._id),
                ...dispensedBefore.map((x) => x._id),
                ...procuredDuring.map((x) => x._id),
                ...dispensedDuringMap.keys(),
            ]),
        ];

        const medicines = await Medicines.find({
            id: { $in: medicineIds },
        });

        const medicineMap = new Map(
            medicines.map((m) => [m.id, m.drug_name_and_dose]),
        );

        const rows = {};

        for (const record of dispenses) {
            if (!rows[record.medicine_id]) {
                const openingBalance =
                    (procuredBeforeMap.get(record.medicine_id) || 0) -
                    (dispensedBeforeMap.get(record.medicine_id) || 0);

                const procuredInRange =
                    procuredDuringMap.get(record.medicine_id) || 0;

                const dispensedInRange =
                    dispensedDuringMap.get(record.medicine_id) || 0;

                rows[record.medicine_id] = {
                    medicine_id: record.medicine_id,
                    medicine_name: medicineMap.get(record.medicine_id),

                    opening_balance: openingBalance,

                    procured_in_range: procuredInRange,

                    dispensed_in_range: dispensedInRange,

                    closing_balance:
                        openingBalance + procuredInRange - dispensedInRange,

                    daily: {},
                };

                dates.forEach((date) => {
                    rows[record.medicine_id].daily[date] = 0;
                });
            }

            rows[record.medicine_id].daily[record.date] += record.units;
        }

        for (const medicineId of medicineIds) {
            if (rows[medicineId]) continue;

            const openingBalance =
                (procuredBeforeMap.get(medicineId) || 0) -
                (dispensedBeforeMap.get(medicineId) || 0);

            const procuredInRange = procuredDuringMap.get(medicineId) || 0;

            const dispensedInRange = dispensedDuringMap.get(medicineId) || 0;

            rows[medicineId] = {
                medicine_id: medicineId,

                medicine_name: medicineMap.get(medicineId),

                opening_balance: openingBalance,

                procured_in_range: procuredInRange,
                dispensed_in_range: dispensedInRange,

                closing_balance:
                    openingBalance + procuredInRange - dispensedInRange,

                daily: {},
            };

            dates.forEach((date) => {
                rows[medicineId].daily[date] = 0;
            });
        }

        res.json({
            success: true,
            dates,
            data: Object.values(rows),
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message,
        });
    }
});

router.get("/verify-stock", protect, async (req, res) => {
    try {
        const now = new Date();

        const startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);

        const endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);

        const dispensedStocks = await Dispense.aggregate([
            {
                $match: {
                    adjustment: { $ne: true },

                    dispensed_on: {
                        $gte: startDate,
                        $lte: endDate,
                    },
                },
            },

            {
                $unwind: "$dispensed_items",
            },

            {
                $group: {
                    _id: "$dispensed_items.stock_id",

                    dispensed_units: {
                        $sum: "$dispensed_items.units",
                    },

                    dispense_count: {
                        $sum: 1,
                    },

                    last_dispensed_on: {
                        $max: "$dispensed_on",
                    },
                },
            },

            {
                $lookup: {
                    from: "stocks",
                    localField: "_id",
                    foreignField: "id",
                    as: "stock",
                },
            },

            {
                $unwind: "$stock",
            },

            {
                $project: {
                    _id: 0,

                    stock_id: "$stock.id",
                    medicine_id: "$stock.medicine_id",
                    item_name: "$stock.item_name",
                    brand: "$stock.brand",
                    expiry_date: "$stock.expiry_date",

                    current_units: "$stock.units",

                    dispensed_units: 1,
                    dispense_count: 1,
                    last_dispensed_on: 1,
                },
            },

            {
                $sort: {
                    item_name: 1,
                    expiry_date: 1,
                },
            },
        ]);

        const stockIds = dispensedStocks.map((item) => item.stock_id);

        const verifications = await StockVerification.find({
            stock_id: {
                $in: stockIds,
            },

            verification_date: {
                $gte: startDate,
                $lte: endDate,
            },
        }).lean();

        const verificationMap = new Map(
            verifications.map((item) => [item.stock_id, item]),
        );

        const data = dispensedStocks.map((stock) => {
            const verification = verificationMap.get(stock.stock_id);

            return {
                ...stock,

                verification: verification
                    ? {
                          id: verification.id,
                          expected_units: verification.expected_units,

                          physical_units: verification.physical_units,

                          difference: verification.difference,

                          status: verification.status,

                          verified_by: verification.verified_by,

                          verified_on: verification.verified_on,
                      }
                    : null,

                status: verification ? verification.status : "UNVERIFIED",
            };
        });

        res.status(200).json({
            success: true,
            data,
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message,
        });
    }
});

router.post("/verify-stock/:stockId", protect, async (req, res) => {
    try {
        const stockId = Number(req.params.stockId);

        const { physical_units } = req.body;

        if (
            physical_units === undefined ||
            physical_units === null ||
            physical_units === ""
        ) {
            return res.status(400).json({
                success: false,
                message: "Physical remaining units are required",
            });
        }

        const physicalUnits = Number(physical_units);

        if (!Number.isInteger(physicalUnits) || physicalUnits < 0) {
            return res.status(400).json({
                success: false,
                message: "Physical units must be a non-negative integer",
            });
        }

        const now = new Date();

        const startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);

        const endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);

        const stock = await Stock.findOne({
            id: stockId,
        });

        if (!stock) {
            return res.status(404).json({
                success: false,
                message: "Stock not found",
            });
        }

        /*
                Confirm that this stock was actually
                dispensed today.
            */
        const dispenseExists = await Dispense.exists({
            adjustment: { $ne: true },

            dispensed_on: {
                $gte: startDate,
                $lte: endDate,
            },

            "dispensed_items.stock_id": stockId,
        });

        if (!dispenseExists) {
            return res.status(400).json({
                success: false,
                message: "This stock was not dispensed today",
            });
        }

        /*
                Prevent duplicate verification for today.
            */
        const existing = await StockVerification.findOne({
            stock_id: stockId,

            verification_date: {
                $gte: startDate,
                $lte: endDate,
            },
        });

        if (existing) {
            return res.status(409).json({
                success: false,
                message: "This stock has already been verified today",
            });
        }

        const expectedUnits = stock.units;

        const difference = physicalUnits - expectedUnits;

        const status = difference === 0 ? "VERIFIED" : "DISPUTE";

        const verification = new StockVerification({
            stock_id: stockId,

            verification_date: new Date(),

            expected_units: expectedUnits,

            physical_units: physicalUnits,

            difference,

            status,

            verified_by: {
                role: req.user.role,
                userId: req.user.userId,
            },
        });

        await verification.save();

        res.status(201).json({
            success: true,

            message:
                status === "VERIFIED"
                    ? "Stock verified successfully"
                    : "Stock moved to disputes",

            data: verification,
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: err.message,
        });
    }
});

export default router;
