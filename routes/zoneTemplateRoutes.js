import express from "express";

import Zone from "../models/Zone.js";
import Medicines from "../models/Medicines.js";

import ZoneTemplateItem from "../models/ZoneTemplateItem.js";

const router = express.Router();

// =============================
// GET TEMPLATE ITEMS
// =============================

router.get("/:zoneId/template-items", async (req, res) => {
    try {
        const zoneId = Number(req.params.zoneId);

        const items = await ZoneTemplateItem.aggregate([
            {
                $match: {
                    zone_id: zoneId,
                },
            },

            {
                $lookup: {
                    from: "medicines",
                    localField: "medicine_id",
                    foreignField: "id",
                    as: "medicine",
                },
            },

            {
                $unwind: "$medicine",
            },

            {
                $project: {
                    _id: 0,

                    zone_id: 1,

                    medicine_id: 1,

                    default_quantity: 1,

                    item_name: "$medicine.drug_name_and_dose",

                    category: "$medicine.category",
                },
            },

            {
                $sort: {
                    item_name: 1,
                },
            },
        ]);

        res.json(items);
    } catch (err) {
        console.error(err);

        res.status(500).json({
            message: "Failed to fetch template items",
        });
    }
});

// =============================
// ADD TEMPLATE ITEM
// =============================

router.post("/:zoneId/template-items", async (req, res) => {
    try {
        const zoneId = Number(req.params.zoneId);

        const { medicine_id, default_quantity } = req.body;

        const zone = await Zone.findOne({
            id: zoneId,
        });

        if (!zone) {
            return res.status(404).json({
                message: "Zone not found",
            });
        }

        const medicine = await Medicines.findOne({
            id: medicine_id,
        });

        if (!medicine) {
            return res.status(404).json({
                message: "Medicine not found",
            });
        }

        const exists = await ZoneTemplateItem.findOne({
            zone_id: zoneId,

            medicine_id,
        });

        if (exists) {
            return res.status(400).json({
                message: "Medicine already exists in template",
            });
        }

        const item = new ZoneTemplateItem({
            zone_id: zoneId,

            medicine_id,

            default_quantity: Math.max(0, Number(default_quantity)),
        });

        await item.save();

        res.json(item);
    } catch (err) {
        console.error(err);

        res.status(500).json({
            message: "Failed to add template item",
        });
    }
});

// =============================
// UPDATE TEMPLATE QUANTITY
// =============================

router.put("/:zoneId/template-items/:medicineId", async (req, res) => {
    try {
        const zoneId = Number(req.params.zoneId);

        const medicineId = Number(req.params.medicineId);

        const { default_quantity } = req.body;

        const updated = await ZoneTemplateItem.findOneAndUpdate(
            {
                zone_id: zoneId,

                medicine_id: medicineId,
            },

            {
                default_quantity: Math.max(0, Number(default_quantity)),
            },

            {
                new: true,
            },
        );

        if (!updated) {
            return res.status(404).json({
                message: "Template item not found",
            });
        }

        res.json(updated);
    } catch (err) {
        console.error(err);

        res.status(500).json({
            message: "Failed to update template",
        });
    }
});

// =============================
// DELETE TEMPLATE ITEM
// =============================

router.delete("/:zoneId/template-items/:medicineId", async (req, res) => {
    try {
        const zoneId = Number(req.params.zoneId);

        const medicineId = Number(req.params.medicineId);

        await ZoneTemplateItem.deleteOne({
            zone_id: zoneId,

            medicine_id: medicineId,
        });

        res.json({
            message: "Template item deleted",
        });
    } catch (err) {
        console.error(err);

        res.status(500).json({
            message: "Failed to delete template item",
        });
    }
});

export default router;
