import express from "express";
import Stock from "../models/Stock.js";
import { protect, allowRoles } from "../middlewares/auth.js";

const router = express.Router();

router.get("/", protect, async (req, res) => {
    try {
        const stock = await Stock.aggregate([
            {
                $match: {
                    units: { $gte: 1 }
                }
            },

            // 🔗 Join Procurement to get vendor names
            {
                $lookup: {
                    from: "procurements",          // Mongo collection name
                    localField: "procurement_id",
                    foreignField: "id",
                    as: "procurement"
                }
            },

            {
                $unwind: "$procurement"
            },

            // 🧮 Group by stock identity
            {
                $group: {
                    _id: {
                        medicine_id: "$medicine_id",
                        item_name: "$item_name",
                        brand: "$brand",
                        per_unit_cost: "$per_unit_cost",
                        expiry_date: "$expiry_date"
                    },
                    units: { $sum: "$units" },
                    vendors: { $addToSet: "$procurement.procured_from" }
                }
            },

            // 🎁 Shape response
            {
                $project: {
                    _id: 0,
                    medicine_id: "$_id.medicine_id",
                    item_name: "$_id.item_name",
                    brand: "$_id.brand",
                    per_unit_cost: "$_id.per_unit_cost",
                    expiry_date: "$_id.expiry_date",
                    units: 1,
                    vendors: 1
                }
            },

            {
                $sort: {
                    item_name: 1,
                    expiry_date: 1
                }
            }
        ]);

        res.json(stock);
    } catch (err) {
        console.error("Stock aggregation error:", err);
        res.status(500).json({ message: "Failed to fetch stock" });
    }
});

// stockRoutes.js
router.get("/raw", protect, async (req, res) => {
  try {
    const stock = await Stock.find({})
      .sort({ item_name: 1, expiry_date: 1 });

    res.json(stock);
  } catch (err) {
    console.error("Raw stock fetch error:", err);
    res.status(500).json({ message: "Failed to fetch raw stock" });
  }
});


export default router;
