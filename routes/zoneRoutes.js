// routes/zones.js
import express from "express";
import Zone from "../models/Zone.js";
import ZoneItem from "../models/ZoneItem.js";
import Medicines from "../models/Medicines.js";
import Stock from "../models/Stock.js";
import ZoneConsumption from "../models/ZoneConsumption.js";

const router = express.Router();

// consume stock batch-by-batch (FIFO)
async function consumeStock(medicine_id, quantity) {
    let needed = quantity;

    const batches = await Stock.find({ medicine_id }).sort({ expiry_date: 1 });

    for (const batch of batches) {
        if (needed <= 0) break;

        const take = Math.min(batch.units, needed);

        batch.units -= take;
        needed -= take;

        await batch.save();
    }

    return quantity - needed; // actual allocated
}

async function getAvailableStock(medicine_id) {
    const result = await Stock.aggregate([
        { $match: { medicine_id } },
        { $group: { _id: null, total: { $sum: "$units" } } },
    ]);

    return result[0]?.total || 0;
}

router.get("/", async (req, res) => {
    try {
        const zones = await Zone.find().sort({ zone_name: 1 });
        res.json(zones);
    } catch (err) {
        res.status(500).json({ message: "Failed to fetch zones" });
    }
});

router.post("/", async (req, res) => {
    const { zone_name, location } = req.body;

    const zone = new Zone({
        zone_name,
        location,
    });

    await zone.save();

    res.json(zone);
});

router.put("/:id", async (req, res) => {
    const updated = await Zone.findOneAndUpdate(
        { id: req.params.id },
        req.body,
        { new: true },
    );

    res.json(updated);
});

router.delete("/:id", async (req, res) => {
    await Zone.deleteOne({ id: req.params.id });
    await ZoneItem.deleteMany({ zone_id: req.params.id });

    res.json({ message: "Zone deleted" });
});

router.get("/:zoneId/items", async (req, res) => {
    const zoneId = Number(req.params.zoneId);

    const items = await ZoneItem.aggregate([
        { $match: { zone_id: zoneId } },
        {
            $lookup: {
                from: "stocks",
                localField: "medicine_id",
                foreignField: "medicine_id",
                as: "stock",
            },
        },
        {
            $addFields: {
                available_stock: { $sum: "$stock.units" },
                expiry_date: { $min: "$stock.expiry_date" },
            },
        },
    ]);

    res.json(items);
});

router.post("/:zoneId/add-item", async (req, res) => {
    const zoneId = Number(req.params.zoneId);

    const medicine_id = Number(req.body.medicine_id);

    const quantity = Math.max(0, Number(req.body.quantity));

    const medicine = await Medicines.findOne({
        id: medicine_id,
    });

    if (!medicine) {
        return res.status(404).json({
            message: "Medicine not found",
        });
    }

    const available = await getAvailableStock(medicine_id);

    if (quantity > available) {
        return res.status(400).json({
            message: `Insufficient stock. Available: ${available}`,
        });
    }

    let allocated = 0;

    if (quantity > 0) {
        allocated = await consumeStock(medicine_id, quantity);
    }

    const existing = await ZoneItem.findOne({
        zone_id: zoneId,
        medicine_id,
    });

    if (existing) {
        existing.quantity += quantity;
        existing.last_replaced = new Date();

        await existing.save();

        return res.json(existing);
    }

    const item = new ZoneItem({
        zone_id: zoneId,

        medicine_id,

        item_name: medicine.drug_name_and_dose,

        category: medicine.category,

        quantity,

        last_replaced: new Date(),
    });

    await item.save();

    res.json(item);
});

// routes/medicines.js
router.get("/search-stock", async (req, res) => {
    const query = req.query.query || "";

    const medicines = await Stock.aggregate([
        {
            $match: {
                units: { $gt: 0 },
            },
        },

        {
            $group: {
                _id: "$medicine_id",
                stock: { $sum: "$units" },
            },
        },

        {
            $lookup: {
                from: "medicines",
                localField: "_id",
                foreignField: "id",
                as: "medicine",
            },
        },

        { $unwind: "$medicine" },

        {
            $match: {
                "medicine.drug_name_and_dose": {
                    $regex: query,
                    $options: "i",
                },
            },
        },

        {
            $project: {
                id: "$medicine.id",
                drug_name_and_dose: "$medicine.drug_name_and_dose",
                category: "$medicine.category",
                stock: 1,
            },
        },

        { $sort: { drug_name_and_dose: 1 } },
        { $limit: 10 },
    ]);

    res.json(medicines);
});

router.post("/:zoneId/replace", async (req, res) => {
    const zoneId = Number(req.params.zoneId);
    const { updates } = req.body;

    if (!updates || !Array.isArray(updates)) {
        return res.status(400).json({ message: "Invalid request" });
    }

    for (const item of updates) {
        const medicine_id = Number(item.medicine_id);
        const qty = Math.max(0, Number(item.replace_qty));

        if (qty <= 0) continue;

        const zoneItem = await ZoneItem.findOne({
            zone_id: zoneId,
            medicine_id,
        });

        if (!zoneItem) continue;

        // STEP 1 — remove from box (consumed)
        const consumed = Math.min(qty, zoneItem.quantity);

        zoneItem.quantity -= consumed;

        await ZoneConsumption.create({
            zone_id: zoneId,
            medicine_id,
            quantity: consumed,
            reason: "REPLACED",
        });

        // STEP 2 — take from central stock
        const allocated = await consumeStock(medicine_id, consumed);

        // STEP 3 — add replacement
        zoneItem.quantity += allocated;
        zoneItem.last_replaced = new Date();

        await zoneItem.save();
    }

    res.json({ message: "Zone updated" });
});

router.post("/:zoneId/consume", async (req, res) => {
    const zoneId = Number(req.params.zoneId);
    const { updates } = req.body;

    for (const item of updates) {
        const medicine_id = Number(item.medicine_id);
        const qty = Math.max(0, Number(item.consumed_qty));

        if (qty <= 0) continue;

        const zoneItem = await ZoneItem.findOne({
            zone_id: zoneId,
            medicine_id,
        });

        if (!zoneItem) continue;

        const consumed = Math.min(qty, zoneItem.quantity);

        zoneItem.quantity -= consumed;

        await ZoneConsumption.create({
            zone_id: zoneId,
            medicine_id,
            quantity: consumed,
            reason: "USED",
            timestamp: new Date(),
            user: req.user?.id || "system",
        });

        await zoneItem.save();
    }

    res.json({ message: "Consumption recorded" });
});

router.post("/:zoneId/add", async (req, res) => {
    const zoneId = Number(req.params.zoneId);
    const { updates } = req.body;

    for (const item of updates) {
        const medicine_id = Number(item.medicine_id);
        const qty = Math.max(0, Number(item.add_qty));

        if (qty <= 0) continue;

        const allocated = await consumeStock(medicine_id, qty);

        const zoneItem = await ZoneItem.findOne({
            zone_id: zoneId,
            medicine_id,
        });

        if (!zoneItem) continue;

        zoneItem.quantity += allocated;
        zoneItem.last_replaced = new Date();

        await zoneItem.save();
    }

    res.json({ message: "Stock added to zone" });
});

router.get("/:zoneId/consumption", async (req, res) => {
    const zoneId = Number(req.params.zoneId);

    const logs = await ZoneConsumption.aggregate([
        {
            $match: { zone_id: zoneId },
        },

        {
            $lookup: {
                from: "medicines",
                localField: "medicine_id",
                foreignField: "id",
                as: "medicine",
            },
        },

        { $unwind: "$medicine" },

        {
            $project: {
                _id: 0,
                medicine_id: 1,
                item_name: "$medicine.drug_name_and_dose",
                quantity: 1,
                reason: 1,
                date: 1,
            },
        },

        { $sort: { date: -1 } },
    ]);

    res.json(logs);
});

router.get("/search-medicines", async (req, res) => {
    const query = req.query.query || "";

    const medicines = await Medicines.find({
        drug_name_and_dose: {
            $regex: query,
            $options: "i",
        },
    })
        .sort({ drug_name_and_dose: 1 })
        .limit(10);

    const results = await Promise.all(
        medicines.map(async (medicine) => {
            const stockData = await Stock.aggregate([
                {
                    $match: {
                        medicine_id: medicine.id,
                    },
                },

                {
                    $group: {
                        _id: null,
                        stock: { $sum: "$units" },
                        expiry_date: { $min: "$expiry_date" },
                    },
                },
            ]);

            return {
                id: medicine.id,

                drug_name_and_dose: medicine.drug_name_and_dose,

                category: medicine.category,

                stock: stockData[0]?.stock || 0,

                expiry_date: stockData[0]?.expiry_date || null,
            };
        }),
    );

    res.json(results);
});

export default router;
