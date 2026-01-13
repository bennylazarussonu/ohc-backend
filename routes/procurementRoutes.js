import Procurement from "../models/Procurement.js";
import Stock from "../models/Stock.js";
import express, { Router } from "express";
import { protect, allowRoles } from "../middlewares/auth.js";

const router = express.Router()

router.post("/add", async (req, res) => {
    try {
        const {
            procured_from,
            procurement_date,
            total_cost,
            items
        } = req.body;

        // 1️⃣ Create Procurement
        const procurement = new Procurement({
            procured_from,
            procurement_date,
            total_cost,
            items
        });

//         const session = await mongoose.startSession();
// session.startTransaction();

// try {
//     await procurement.save({ session });

//     for (const item of items) {
//         if (item.units < 1) continue;

//         const stock = new Stock({...});
//         await stock.save({ session });
//     }

//     await session.commitTransaction();
//     session.endSession();

// } catch (e) {
//     await session.abortTransaction();
//     session.endSession();
//     throw e;
// }

        await procurement.save();

        for (const item of items) {
            if (item.units < 1) continue;

            const stock = new Stock({
                procurement_id: procurement.id,
                item_name: item.item_name,
                brand: item.brand,
                units: item.units,
                per_unit_cost: item.per_unit_cost,
                procurement_date,
                medicine_id: item.medicine_id
            });

            await stock.save(); // Counter runs ✔
        }

        res.status(201).json({
            message: "Procurement and stock saved",
            procurement_id: procurement.id
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to save procurement" });
    }
});

export default router;