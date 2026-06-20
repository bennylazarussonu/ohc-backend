import Stock from "../models/Stock.js";
import StockAdjustment from "../models/StockAdjustment.js";
import express from "express";
import Dispense from "../models/Dispense.js";
import mongoose from "mongoose";
import Medicines from "../models/Medicines.js";
import Procurement from "../models/Procurement.js";
import { protect } from "../middlewares/auth.js";

const router = express.Router();

const createRandomDispenseEvents = (
    totalUnits,
    fromDate,
    toDate,
    holidays = [],
) => {
    const start = new Date(fromDate);
    const end = new Date(toDate);

    const validDates = [];

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const current = new Date(d);

        // Skip Sundays
        if (current.getDay() === 0) {
            continue;
        }

        const formatted = current.toISOString().split("T")[0];

        // Skip holidays
        if (holidays.includes(formatted)) {
            continue;
        }

        validDates.push(new Date(current));
    }

    if (validDates.length === 0) {
        return [];
    }

    // Decide number of dispense events
    const numberOfEvents = Math.min(
        validDates.length,
        Math.max(1, Math.ceil(totalUnits / 15)),
    );

    // Shuffle dates
    const shuffledDates = validDates.sort(() => Math.random() - 0.5);

    const selectedDates = shuffledDates
        .slice(0, numberOfEvents)
        .sort((a, b) => a - b);

    const events = [];

    let remaining = totalUnits;

    for (let i = 0; i < selectedDates.length; i++) {
        const eventsLeft = selectedDates.length - i;

        if (eventsLeft === 1) {
            events.push({
                date: selectedDates[i],
                units: remaining,
            });

            break;
        }

        const avg = Math.floor(remaining / eventsLeft);

        const variance = Math.max(1, Math.floor(avg * 0.5));

        let units =
            avg + Math.floor(Math.random() * (variance * 2 + 1)) - variance;

        if (units < 1) units = 1;

        if (units > remaining - (eventsLeft - 1)) {
            units = remaining - (eventsLeft - 1);
        }

        events.push({
            date: selectedDates[i],
            units,
        });

        remaining -= units;
    }

    return events;
};

// FOR PRODUCTION - Uncomment this before pushing into production
router.post("/reconcile-opening", protect, async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const { from_date, to_date, items } = req.body;
        const holidays = [];

        if (!items?.length) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: "No items provided" });
        }

        const adjustedItems = [];
        const dispenseDocs = [];

        for (const item of items) {
            const stock = await Stock.findOne({
                id: item.stock_id,
            }).session(session);
            if (!stock) continue;

            const consumedUnits = stock.units - Number(item.remaining_units);

            if (consumedUnits < 0) {
                await session.abortTransaction();
                session.endSession();
                return res.status(400).json({
                    message: `Remaining units cannot exceed current units for ${stock.item_name}`,
                });
            }

            // 🔻 Update stock
            stock.units = Number(item.remaining_units);
            await stock.save({ session });

            if (consumedUnits > 0) {
                adjustedItems.push({
                    stock_id: stock.id,
                    medicine_id: stock.medicine_id,
                    item_name: stock.item_name,
                    brand: stock.brand,
                    consumed_units: consumedUnits,
                    from_date,
                    to_date,
                    remarks: item.remarks || "Consumed",
                });
                if ((item.remarks || "Consumed") === "Consumed") {
                    const distributions = createRandomDispenseEvents(
                        consumedUnits,
                        from_date,
                        to_date,
                        holidays,
                    );

                    for (const entry of distributions) {
                        dispenseDocs.push(
                            new Dispense({
                                adjustment_id: null,
                                opd_id: null,

                                dispensed_items: [
                                    {
                                        stock_id: stock.id,
                                        units: entry.units,
                                    },
                                ],

                                dispensed_to_worker_id: null,

                                adjustment: true,

                                dispensed_by: {
                                    role: req.user.role,
                                    userId: req.user.userId,
                                },

                                dispensed_on: entry.date,
                            }),
                        );
                    }
                }
            }
        }

        // 🧾 Save adjustment log
        const adjustment = new StockAdjustment({
            adjusted_items: adjustedItems,
            adjusted_by: {
                role: req.user.role,
                userId: req.user.userId,
            },
        });

        await adjustment.save({ session });

        for (const doc of dispenseDocs) {
            doc.adjustment_id = adjustment.id;
        }

        if (dispenseDocs.length > 0) {
            for (const dispense of dispenseDocs) {
                await dispense.save({ session });
            }
        }

        await session.commitTransaction();
        session.endSession();

        res.json({
            success: true,
            message: "Stock Adjusted successfully",
            adjustment,
        });
    } catch (err) {
        await session.abortTransaction();
        session.endSession();
        res.status(500).json({ message: err.message });
    }
});

// FOR DEVELOPMENT - Use this for testing and development, as it doesn't use transactions and is simpler to debug. Switch to the above version for production use.
// router.post("/reconcile-opening", protect, async (req, res) => {
//     try {
//         const { from_date, to_date, items } = req.body;

//         const holidays = [];

//         if (!items?.length) {
//             return res.status(400).json({
//                 message: "No items provided",
//             });
//         }

//         const adjustedItems = [];
//         const dispenseDocs = [];

//         for (const item of items) {
//             const stock = await Stock.findOne({
//                 id: item.stock_id,
//             });

//             if (!stock) continue;

//             const consumedUnits = stock.units - Number(item.remaining_units);

//             if (consumedUnits < 0) {
//                 return res.status(400).json({
//                     message: `Remaining units cannot exceed current units for ${stock.item_name}`,
//                 });
//             }

//             // 🔻 Update stock
//             stock.units = Number(item.remaining_units);

//             await stock.save();

//             if (consumedUnits > 0) {
//                 adjustedItems.push({
//                     stock_id: stock.id,
//                     medicine_id: stock.medicine_id,
//                     item_name: stock.item_name,
//                     brand: stock.brand,
//                     consumed_units: consumedUnits,
//                     from_date,
//                     to_date,
//                     remarks: item.remarks || "Consumed",
//                 });

//                 // 🔻 Create dispense history only for consumed
//                 if ((item.remarks || "Consumed") === "Consumed") {
//                     const distributions = createRandomDispenseEvents(
//                         consumedUnits,
//                         from_date,
//                         to_date,
//                         holidays,
//                     );

//                     for (const entry of distributions) {
//                         dispenseDocs.push({
//                             adjustment_id: null,
//                             opd_id: null,

//                             dispensed_items: [
//                                 {
//                                     stock_id: stock.id,
//                                     units: entry.units,
//                                 },
//                             ],

//                             dispensed_to_worker_id: null,

//                             adjustment: true,

//                             dispensed_by: {
//                                 role: req.user.role,
//                                 userId: req.user.userId,
//                             },

//                             dispensed_on: entry.date,
//                         });
//                     }
//                 }
//             }
//         }

//         // 🔻 Save adjustment log
//         const adjustment = new StockAdjustment({
//             adjusted_items: adjustedItems,

//             adjusted_by: {
//                 role: req.user.role,
//                 userId: req.user.userId,
//             },
//         });

//         await adjustment.save();

//         for (const doc of dispenseDocs) {
//             doc.adjustment_id = adjustment.id;
//         }

//         // 🔻 Bulk insert dispenses
//         if (dispenseDocs.length > 0) {
//             for (const doc of dispenseDocs) {
//                 await Dispense.create(doc);
//             }
//         }

//         res.json({
//             success: true,
//             message: "Stock Adjusted successfully",
//             adjustment,
//         });
//     } catch (err) {
//         res.status(500).json({
//             message: err.message,
//         });
//     }
// });

// router.post("/reconcile-opening", protect, async (req, res) => {
//   try {
//     const { from_date, to_date, items } = req.body;

//     if (!items?.length) {
//       return res.status(400).json({ message: "No items provided" });
//     }

//     const adjustedItems = [];

//     for (const item of items) {
//       const stock = await Stock.findOne({ id: item.stock_id });
//       if (!stock) continue;

//       const consumedUnits = stock.units - Number(item.remaining_units);

//       if (consumedUnits < 0) {
//         return res.status(400).json({
//           message: `Remaining units cannot exceed current units for ${stock.item_name}`
//         });
//       }

//       // 🔻 Update stock
//       stock.units = Number(item.remaining_units);
//       await stock.save();

//       if (consumedUnits > 0) {
//         adjustedItems.push({
//   stock_id: stock.id,
//   medicine_id: stock.medicine_id,
//   item_name: stock.item_name,
//   brand: stock.brand,
//   consumed_units: consumedUnits,
//   from_date,
//   to_date,
//   remarks: item.remarks || "Consumed"
// });

//       }
//     }

//     // 🧾 Save adjustment log
//     const adjustment = new StockAdjustment({
//       adjusted_items: adjustedItems,
//       adjusted_by: {
//         role: req.user.role,
//         userId: req.user.userId
//       }
//     });

//     await adjustment.save();

//     res.json({
//       success: true,
//       message: "Stock Adjusted successfully",
//       adjustment
//     });

//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// });

router.get(
    "/reconciliation-stock",
    protect,
    async (req, res) => {
        try {
            const stocks = await Stock.find({
                units: { $gte: 0 }
            })
            .sort({
                item_name: 1,
                expiry_date: 1
            });

            res.json({
                success: true,
                data: stocks
            });

        } catch (err) {
            res.status(500).json({
                success: false,
                message: err.message
            });
        }
    }
);
export default router;
