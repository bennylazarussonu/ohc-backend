import express from "express";

import Stock from "../models/Stock.js";

import Zone from "../models/Zone.js";

import Medicines from "../models/Medicines.js";

import ZoneInventoryBatch from "../models/ZoneInventoryBatch.js";
import ZoneTemplateItem from "../models/ZoneTemplateItem.js";
import ZoneConsumption from "../models/ZoneConsumption.js";
import ZoneVisit from "../models/ZoneVisit.js";
import ZoneAllocation from "../models/ZoneAllocation.js";

const router = express.Router();

// ======================================
// GET CURRENT ZONE INVENTORY
// ======================================

router.get("/available/:medicineId", async (req, res) => {
    try {
        const medicineId = Number(req.params.medicineId);
        console.log(medicineId);

        const today = new Date();

        today.setHours(0, 0, 0, 0);

        const batches = await Stock.find({
            medicine_id: medicineId,

            units: { $gt: 0 },

            is_expired: { $ne: true },

            $or: [{ expiry_date: { $gte: today } }, { expiry_date: null }],
        }).sort({
            expiry_date: 1,
        });

        res.json(batches);
    } catch (err) {
        console.error(err);

        res.status(500).json({
            message: "Failed to fetch batches",
        });
    }
});

router.get("/:zoneId/inventory", async (req, res) => {
    try {
        const zoneId = Number(req.params.zoneId);

        const inventory = await ZoneInventoryBatch.find({
            zone_id: zoneId,

            quantity: { $gt: 0 },
        }).sort({
            expiry_date: 1,
        });

        res.json(inventory);
    } catch (err) {
        console.error(err);

        res.status(500).json({
            message: "Failed to fetch inventory",
        });
    }
});

// ======================================
// ALLOCATE STOCK INTO FAB
// ======================================

router.post("/:zoneId/allocate", async (req, res) => {
    try {
        const zoneId = Number(req.params.zoneId);

        const { stock_id, quantity, visit_id } = req.body;
        if (!visit_id) {
            return res.status(400).json({
                message: "Start visit first",
            });
        }

        const qty = Number(quantity);

        if (isNaN(qty) || qty < 1) {
            return res.status(400).json({
                message: "Invalid quantity",
            });
        }

        // =========================
        // VALIDATE ZONE
        // =========================

        const zone = await Zone.findOne({
            id: zoneId,
        });

        if (!zone) {
            return res.status(404).json({
                message: "Zone not found",
            });
        }

        // =========================
        // GET STOCK BATCH
        // =========================

        const today = new Date();

        today.setHours(0, 0, 0, 0);

        const batch = await Stock.findOne({
            id: stock_id,

            units: { $gt: 0 },

            is_expired: { $ne: true },

            $or: [
                {
                    expiry_date: {
                        $gte: today,
                    },
                },
                {
                    expiry_date: null,
                },
            ],
        });

        if (!batch) {
            return res.status(404).json({
                message: "Stock batch not found",
            });
        }

        // =========================
        // CHECK TEMPLATE LIMIT
        // =========================

        const templateItem = await ZoneTemplateItem.findOne({
            zone_id: zoneId,

            medicine_id: batch.medicine_id,
        });

        if (!templateItem) {
            return res.status(400).json({
                message: "Medicine not present in template",
            });
        }

        // already allocated

        const existingBatches = await ZoneInventoryBatch.find({
            zone_id: zoneId,

            medicine_id: batch.medicine_id,
        });

        const allocatedQty = existingBatches.reduce(
            (sum, item) => sum + item.quantity,

            0,
        );

        const remainingAllowed = templateItem.default_quantity - allocatedQty;

        if (remainingAllowed <= 0) {
            return res.status(400).json({
                message: "Required quantity already fulfilled",
            });
        }

        if (qty > remainingAllowed) {
            return res.status(400).json({
                message: `Only ${remainingAllowed} more allowed`,
            });
        }

        // =========================
        // CHECK AVAILABLE UNITS
        // =========================

        if (batch.units < qty) {
            return res.status(400).json({
                message: `Only ${batch.units} units available`,
            });
        }

        // =========================
        // REDUCE CENTRAL STOCK
        // =========================

        batch.units -= qty;

        await batch.save();

        // =========================
        // MERGE EXISTING FAB BATCH
        // =========================

        let fabBatch = await ZoneInventoryBatch.findOne({
            zone_id: zoneId,

            stock_id: batch.id,
        });

        if (fabBatch) {
            fabBatch.quantity += qty;

            await fabBatch.save();
        } else {
            fabBatch = new ZoneInventoryBatch({
                zone_id: zoneId,

                medicine_id: batch.medicine_id,

                stock_id: batch.id,

                item_name: batch.item_name,

                brand: batch.brand,

                quantity: qty,

                expiry_date: batch.expiry_date,

                per_unit_cost: batch.per_unit_cost,
            });

            await fabBatch.save();
        }
        await ZoneAllocation.create({
            visit_id,

            zone_id: zoneId,

            medicine_id: batch.medicine_id,

            stock_id: batch.id,

            item_name: batch.item_name,

            brand: batch.brand,

            quantity,

            expiry_date: batch.expiry_date,

            per_unit_cost: batch.per_unit_cost,

            allocated_by: req.user?.username || "Unknown",
        });

        res.json({
            message: "Stock allocated",

            allocated: fabBatch,
        });
    } catch (err) {
        console.error(err);

        res.status(500).json({
            message: "Allocation failed",
        });
    }
});

router.post("/:zoneId/consume", async (req, res) => {
    try {
        const zoneId = Number(req.params.zoneId);

        const { inventory_batch_id, quantity, reason, visit_id } = req.body;

        if (!visit_id) {
            return res.status(400).json({
                message: "Start visit first",
            });
        }

        const qty = Number(quantity);

        if (isNaN(qty) || qty < 1) {
            return res.status(400).json({
                message: "Invalid quantity",
            });
        }

        const batch = await ZoneInventoryBatch.findById(inventory_batch_id);

        if (!batch) {
            return res.status(404).json({
                message: "Inventory batch not found",
            });
        }

        if (batch.zone_id !== zoneId) {
            return res.status(400).json({
                message: "Wrong zone batch",
            });
        }

        if (batch.quantity < qty) {
            return res.status(400).json({
                message: `Only ${batch.quantity} available`,
            });
        }

        batch.quantity -= qty;

        await batch.save();

        await ZoneConsumption.create({
            visit_id,

            zone_id: zoneId,

            medicine_id: batch.medicine_id,

            item_name: batch.item_name,

            brand: batch.brand,

            expiry_date: batch.expiry_date,

            per_unit_cost: batch.per_unit_cost,

            quantity: qty,

            reason: reason || "USED",
        });

        res.json({
            message: "Medicine consumed",
        });
    } catch (err) {
        console.error(err);

        res.status(500).json({
            message: "Consumption failed",
        });
    }
});

router.post(
    "/:zoneId/start-visit",

    async (req, res) => {
        try {
            const zoneId = Number(req.params.zoneId);
            const existingVisit = await ZoneVisit.findOne({
                zone_id: zoneId,

                is_closed: false,
            });

            if (existingVisit) {
                return res.status(400).json({
                    message: "Active visit already exists",

                    visit: existingVisit,
                });
            }

            const { remarks, visited_by } = req.body;

            const zone = await Zone.findOne({
                id: zoneId,
            });

            if (!zone) {
                return res.status(404).json({
                    message: "Zone not found",
                });
            }

            const visit = new ZoneVisit({
                zone_id: zoneId,

                remarks,

                visited_by,
            });

            await visit.save();

            res.json(visit);
        } catch (err) {
            console.error(err);

            res.status(500).json({
                message: "Failed to start visit",
            });
        }
    },
);

router.post(
    "/visits/:visitId/close",

    async (req, res) => {
        try {
            const visitId = Number(req.params.visitId);

            const visit = await ZoneVisit.findOne({
                id: visitId,
            });

            if (!visit) {
                return res.status(404).json({
                    message: "Visit not found",
                });
            }

            if (visit.is_closed) {
                return res.status(400).json({
                    message: "Visit already closed",
                });
            }

            visit.is_closed = true;

            await visit.save();

            res.json({
                message: "Visit closed",
            });
        } catch (err) {
            console.error(err);

            res.status(500).json({
                message: "Failed to close visit",
            });
        }
    },
);

router.get(
    "/:zoneId/last-visit",

    async (req, res) => {
        try {
            const zoneId = Number(req.params.zoneId);

            const lastVisit = await ZoneVisit.findOne({
                zone_id: zoneId,
            }).sort({
                visit_date: -1,
            });

            res.json(lastVisit);
        } catch (err) {
            console.error(err);

            res.status(500).json({
                message: "Failed to fetch last visit",
            });
        }
    },
);

router.get(
    "/:zoneId/active-visit",

    async (req, res) => {
        try {
            const zoneId = Number(req.params.zoneId);

            const visit = await ZoneVisit.findOne({
                zone_id: zoneId,

                is_closed: false,
            });

            res.json(visit);
        } catch (err) {
            console.error(err);

            res.status(500).json({
                message: "Failed to fetch active visit",
            });
        }
    },
);

router.get(
    "/:zoneId/history",

    async (req, res) => {
        try {
            const zoneId = Number(req.params.zoneId);

            const visits = await ZoneVisit.find({
                zone_id: zoneId,
            }).sort({
                visit_date: -1,
            });

            const history = [];

            for (const visit of visits) {
                const consumptions = await ZoneConsumption.find({
                    visit_id: visit.id,
                });

                const allocations = await ZoneAllocation.find({
                    visit_id: visit.id,
                });

                history.push({
                    visit,

                    consumptions,

                    allocations,
                });
            }

            res.json(history);
        } catch (err) {
            console.error(err);

            res.status(500).json({
                message: "Failed to fetch history",
            });
        }
    },
);

export default router;
