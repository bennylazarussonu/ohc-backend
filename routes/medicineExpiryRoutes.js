import express from "express";
import ExpiredMedicineLog from "../models/ExpiredMedicineLog.js";
import Stock from "../models/Stock.js";
import ZoneItem from "../models/ZoneItem.js";

const router = express.Router();

router.get("/warnings", async (req, res) => {

    try {

        const today = new Date();

        const nextMonth = new Date();

        nextMonth.setMonth(
            nextMonth.getMonth() + 1
        );

        // =========================
        // CENTRAL STOCK WARNINGS
        // =========================

        const stockWarnings = await Stock.find({
    expiry_date: {
        $ne: null,
        $gte: today,
        $lte: nextMonth
    },

    units: { $gt: 0 },

    is_expired: false
});
        // =========================
        // ZONE WARNINGS
        // =========================

        const zoneWarnings = await ZoneItem.find({
    expiry_date: {
        $ne: null,
        $gte: today,
        $lte: nextMonth
    },

    quantity: { $gt: 0 },

    is_expired: false
});

        res.json({
            stock: stockWarnings,
            zones: zoneWarnings
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            message: "Failed to fetch warnings"
        });
    }
});

router.get("/history", async (req, res) => {

    const logs = await ExpiredMedicineLog
        .find({})
        .sort({ removed_at: -1 });

    res.json(logs);
});

export default router;