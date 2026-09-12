import express from "express";
import mongoose from "mongoose";

import Zone from "../models/Zone.js";
import Medicines from "../models/Medicines.js";
import FABVisit from "../models/FABVisit.js";
import FABTemplateItem from "../models/FABTemplateItem.js";
import FABInventoryBatch from "../models/FABInventoryBatch.js";
import Stock from "../models/Stock.js";
import FABAllocation from "../models/FABAllocation.js";
import FABConsumption from "../models/FABConsumption.js";
import FABInventoryAdjustment from "../models/FABInventoryAdjustment.js";

const router = express.Router();

/*
 * POST /api/fab/template
 *
 * Adds a medicine to a FAB template.
 *
 * Optionally creates opening physical stock for that medicine.
 *
 * Important:
 * - Opening stock does NOT reduce central Stock.
 * - Template and opening inventory are created atomically.
 */
router.post("/template", async (req, res) => {
    const session = await mongoose.startSession();

    try {
        const {
            zone_id,
            medicine_id,
            required_quantity,
            opening_quantity = 0,
            brand = "",
            expiry_date = null,
            per_unit_cost = 0,
        } = req.body;

        // --------------------------------------------------
        // 1. Basic validation
        // --------------------------------------------------

        if (!Number.isInteger(Number(zone_id))) {
            return res.status(400).json({
                message: "zone_id must be a valid number",
            });
        }

        if (!Number.isInteger(Number(medicine_id))) {
            return res.status(400).json({
                message: "medicine_id must be a valid number",
            });
        }

        if (
            !Number.isInteger(Number(required_quantity)) ||
            Number(required_quantity) < 1
        ) {
            return res.status(400).json({
                message: "required_quantity must be at least 1",
            });
        }

        if (
            !Number.isInteger(Number(opening_quantity)) ||
            Number(opening_quantity) < 0
        ) {
            return res.status(400).json({
                message: "opening_quantity cannot be negative",
            });
        }

        if (Number(per_unit_cost) < 0) {
            return res.status(400).json({
                message: "per_unit_cost cannot be negative",
            });
        }

        // --------------------------------------------------
        // 2. Convert numeric IDs
        // --------------------------------------------------

        const zoneId = Number(zone_id);
        const medicineId = Number(medicine_id);
        const requiredQty = Number(required_quantity);
        const openingQty = Number(opening_quantity);
        const unitCost = Number(per_unit_cost);

        // --------------------------------------------------
        // 3. Verify Zone exists
        // --------------------------------------------------

        const zone = await Zone.findOne({ id: zoneId }).session(session);

        if (!zone) {
            return res.status(404).json({
                message: "FAB/Zone not found",
            });
        }

        // --------------------------------------------------
        // 4. Verify Medicine exists
        // --------------------------------------------------

        const medicine = await Medicines.findOne({
            id: medicineId,
        }).session(session);

        if (!medicine) {
            return res.status(404).json({
                message: "Medicine not found",
            });
        }

        // --------------------------------------------------
        // 5. Check for duplicate template item
        // --------------------------------------------------

        const existingTemplateItem = await FABTemplateItem.findOne({
            zone_id: zoneId,
            medicine_id: medicineId,
        }).session(session);

        if (existingTemplateItem) {
            return res.status(409).json({
                message:
                    "This medicine is already present in this FAB template",
            });
        }

        // --------------------------------------------------
        // 6. Start transaction
        // --------------------------------------------------

        session.startTransaction();

        // --------------------------------------------------
        // 7. Create template item
        // --------------------------------------------------

        const templateItem = new FABTemplateItem({
            zone_id: zoneId,
            medicine_id: medicineId,
            required_quantity: requiredQty,
        });

        await templateItem.save({ session });

        // --------------------------------------------------
        // 8. Create opening inventory if quantity > 0
        // --------------------------------------------------

        let openingBatch = null;

        if (openingQty > 0) {
            openingBatch = new FABInventoryBatch({
                zone_id: zoneId,
                medicine_id: medicineId,

                source_type: "OPENING",
                source_id: null,

                item_name: medicine.drug_name_and_dose,

                brand: brand || "",

                quantity: openingQty,

                expiry_date: expiry_date ? new Date(expiry_date) : null,

                per_unit_cost: unitCost,

                received_at: new Date(),
            });

            await openingBatch.save({ session });
        }

        // --------------------------------------------------
        // 9. Commit transaction
        // --------------------------------------------------

        await session.commitTransaction();

        return res.status(201).json({
            message: "Medicine added to FAB template successfully",

            template_item: templateItem,

            opening_batch: openingBatch,
        });
    } catch (error) {
        // --------------------------------------------------
        // Roll back everything if anything failed
        // --------------------------------------------------

        if (session.inTransaction()) {
            await session.abortTransaction();
        }

        console.error("FAB template creation error:", error);

        // Handle duplicate-key race condition
        if (error.code === 11000) {
            return res.status(409).json({
                message:
                    "This medicine is already present in this FAB template",
            });
        }

        return res.status(500).json({
            message: "Failed to add medicine to FAB template",
            error: error.message,
        });
    } finally {
        await session.endSession();
    }
});

router.post("/visit/open", async (req, res) => {
    try {
        const { zone_id, started_by = "Unknown" } = req.body;

        if (!Number.isInteger(Number(zone_id))) {
            return res.status(400).json({
                message: "zone_id must be a valid number",
            });
        }

        const zoneId = Number(zone_id);

        const zone = await Zone.findOne({ id: zoneId });

        if (!zone) {
            return res.status(404).json({
                message: "FAB/Zone not found",
            });
        }

        const existingOpenVisit = await FABVisit.findOne({
            zone_id: zoneId,
            status: "OPEN",
        });

        if (existingOpenVisit) {
            return res.status(409).json({
                message: "This FAB already has an open visit",
                visit: existingOpenVisit,
            });
        }

        const visit = new FABVisit({
            zone_id: zoneId,
            status: "OPEN",
            started_at: new Date(),
            started_by,
        });

        await visit.save();

        return res.status(201).json({
            message: "FAB visit opened successfully",
            visit,
        });
    } catch (error) {
        console.error("FAB visit opening error:", error);

        if (error.code === 11000) {
            return res.status(409).json({
                message: "This FAB already has an open visit",
            });
        }

        return res.status(500).json({
            message: "Failed to open FAB visit",
            error: error.message,
        });
    }
});

router.get("/visit/open/:zone_id", async (req, res) => {
    try {
        const zoneId = Number(req.params.zone_id);

        if (!Number.isInteger(zoneId)) {
            return res.status(400).json({
                message: "zone_id must be a valid number",
            });
        }

        const visit = await FABVisit.findOne({
            zone_id: zoneId,
            status: "OPEN",
        });

        // if (!visit) {
        //     return res.status(404).json({
        //         message: "No open visit found for this FAB",
        //     });
        // }

        return res.status(200).json({
            visit: visit || null,
        });
    } catch (error) {
        console.error("FAB open visit retrieval error:", error);

        return res.status(500).json({
            message: "Failed to retrieve open FAB visit",
            error: error.message,
        });
    }
});

router.get("/visit/history/:zone_id", async (req, res) => {
    try {
        const zoneId = Number(req.params.zone_id);

        if (Number.isNaN(zoneId)) {
            return res.status(400).json({
                message: "zone_id must be a valid number",
            });
        }

        const zone = await Zone.findOne({ id: zoneId });

        if (!zone) {
            return res.status(404).json({
                message: "Zone not found",
            });
        }

        const visits = await FABVisit.find({
            zone_id: zoneId,
        })
            .sort({ started_at: -1 })
            .lean();

        return res.json({
            zone_id: zoneId,
            zone_name: zone.zone_name,
            visits,
        });
    } catch (error) {
        console.error("Get FAB visit history error:", error);

        return res.status(500).json({
            message: "Failed to fetch FAB visit history",
            error: error.message,
        });
    }
});

router.post("/visit/close", async (req, res) => {
    try {
        const { zone_id, closed_by = "Unknown" } = req.body;

        if (!zone_id) {
            return res.status(400).json({
                message: "zone_id is required",
            });
        }

        const zoneId = Number(zone_id);

        if (Number.isNaN(zoneId)) {
            return res.status(400).json({
                message: "zone_id must be a valid number",
            });
        }

        const visit = await FABVisit.findOne({
            zone_id: zoneId,
            status: "OPEN",
        });

        if (!visit) {
            return res.status(404).json({
                message: "No open FAB visit found for this zone",
            });
        }

        visit.status = "CLOSED";
        visit.closed_at = new Date();
        visit.closed_by = closed_by;

        await visit.save();

        return res.json({
            message: "FAB visit closed successfully",
            visit,
        });
    } catch (error) {
        console.error("Close FAB visit error:", error);

        return res.status(500).json({
            message: "Failed to close FAB visit",
            error: error.message,
        });
    }
});

router.get("/inventory/:zone_id", async (req, res) => {
    try {
        const zoneId = Number(req.params.zone_id);

        if (!Number.isInteger(zoneId)) {
            return res.status(400).json({
                message: "zone_id must be a valid number",
            });
        }

        // --------------------------------------------------
        // 1. Verify FAB / Zone exists
        // --------------------------------------------------

        const zone = await Zone.findOne({
            id: zoneId,
        });

        if (!zone) {
            return res.status(404).json({
                message: "FAB/Zone not found",
            });
        }

        // --------------------------------------------------
        // 2. Get FAB template
        // --------------------------------------------------

        const templateItems = await FABTemplateItem.find({
            zone_id: zoneId,
        }).lean();

        // --------------------------------------------------
        // 3. Get all inventory batches
        // --------------------------------------------------

        const inventoryBatches = await FABInventoryBatch.find({
            zone_id: zoneId,
        })
            .sort({
                medicine_id: 1,
                expiry_date: 1,
                received_at: 1,
            })
            .lean();

        // --------------------------------------------------
        // 4. Get medicine details
        // --------------------------------------------------

        const medicineIds = [
            ...new Set(templateItems.map((item) => item.medicine_id)),
        ];

        const medicines = await Medicines.find({
            id: { $in: medicineIds },
        }).lean();

        const medicineMap = new Map(
            medicines.map((medicine) => [medicine.id, medicine]),
        );

        // --------------------------------------------------
        // 5. Build inventory summary
        // --------------------------------------------------

        const inventoryMap = new Map();

        for (const batch of inventoryBatches) {
            if (!inventoryMap.has(batch.medicine_id)) {
                inventoryMap.set(batch.medicine_id, {
                    medicine_id: batch.medicine_id,
                    current_quantity: 0,
                    batches: [],
                });
            }

            const medicineInventory = inventoryMap.get(batch.medicine_id);

            medicineInventory.current_quantity += batch.quantity;

            medicineInventory.batches.push(batch);
        }

        // --------------------------------------------------
        // 5. Combine template + actual inventory
        // --------------------------------------------------

        const inventory = [];

        for (const templateItem of templateItems) {
            const medicineInventory = inventoryMap.get(
                templateItem.medicine_id,
            );

            const currentQuantity = medicineInventory?.current_quantity || 0;

            const requiredQuantity = templateItem.required_quantity;

            const remainingQuantity = requiredQuantity - currentQuantity;

            let status = "FULL";

            if (currentQuantity === 0) {
                status = "EMPTY";
            } else if (remainingQuantity > 0) {
                status = "SHORT";
            } else if (remainingQuantity < 0) {
                status = "OVERSTOCK";
            }

            inventory.push({
                template_item_id: templateItem._id,
                medicine_id: templateItem.medicine_id,
                required_quantity: requiredQuantity,
                current_quantity: currentQuantity,
                remaining_quantity: remainingQuantity,
                status,
                medicine_name:
                    medicineMap.get(templateItem.medicine_id)
                        ?.drug_name_and_dose || "Unknown Medicine",
                batches: medicineInventory?.batches || [],
            });
        }

        // --------------------------------------------------
        // 6. Return inventory
        // --------------------------------------------------

        return res.status(200).json({
            zone_id: zoneId,
            zone_name: zone.zone_name,
            inventory,
        });
    } catch (error) {
        console.error("FAB inventory retrieval error:", error);

        return res.status(500).json({
            message: "Failed to retrieve FAB inventory",
            error: error.message,
        });
    }
});

router.post("/allocate", async (req, res) => {
    const session = await mongoose.startSession();

    try {
        const {
            zone_id,
            medicine_id,
            stock_id,
            quantity,
            allocated_by = "Unknown",
        } = req.body;

        if (!Number.isInteger(Number(zone_id))) {
            return res.status(400).json({
                message: "zone_id must be a valid number",
            });
        }

        if (!Number.isInteger(Number(medicine_id))) {
            return res.status(400).json({
                message: "medicine_id must be a valid number",
            });
        }

        if (!Number.isInteger(Number(stock_id))) {
            return res.status(400).json({
                message: "stock_id must be a valid number",
            });
        }

        if (!Number.isInteger(Number(quantity)) || Number(quantity) < 1) {
            return res.status(400).json({
                message: "quantity must be at least 1",
            });
        }

        const zoneId = Number(zone_id);
        const medicineId = Number(medicine_id);
        const stockId = Number(stock_id);
        const allocationQty = Number(quantity);

        const zone = await Zone.findOne({
            id: zoneId,
        }).session(session);

        if (!zone) {
            return res.status(404).json({
                message: "FAB/Zone not found",
            });
        }

        const medicine = await Medicines.findOne({
            id: medicineId,
        }).session(session);

        if (!medicine) {
            return res.status(404).json({
                message: "Medicine not found",
            });
        }

        const visit = await FABVisit.findOne({
            zone_id: zoneId,
            status: "OPEN",
        }).session(session);

        if (!visit) {
            return res.status(400).json({
                message: "No open visit found for this FAB",
            });
        }

        const stock = await Stock.findOne({
            id: stockId,
            medicine_id: medicineId,
            is_expired: false,
        }).session(session);

        if (!stock) {
            return res.status(404).json({
                message: "Valid central stock batch not found",
            });
        }

        if (stock.units < allocationQty) {
            return res.status(400).json({
                message: "Insufficient central stock",
                available_units: stock.units,
            });
        }

        session.startTransaction();

        stock.units -= allocationQty;
        await stock.save({ session });

        const inventoryBatch = new FABInventoryBatch({
            zone_id: zoneId,
            medicine_id: medicineId,
            source_type: "CENTRAL_STOCK",
            source_id: stock.id,
            item_name: stock.item_name,
            brand: stock.brand || "",
            quantity: allocationQty,
            expiry_date: stock.expiry_date || null,
            per_unit_cost: stock.per_unit_cost || 0,
            received_at: new Date(),
        });

        await inventoryBatch.save({ session });

        const allocation = new FABAllocation({
            visit_id: visit._id,
            zone_id: zoneId,
            medicine_id: medicineId,
            stock_id: stock.id,
            item_name: stock.item_name,
            brand: stock.brand || "",
            quantity: allocationQty,
            expiry_date: stock.expiry_date || null,
            per_unit_cost: stock.per_unit_cost || 0,
            allocated_by,
            allocated_at: new Date(),
        });

        await allocation.save({ session });

        await session.commitTransaction();

        return res.status(201).json({
            message: "Medicine allocated to FAB successfully",
            allocation,
            inventory_batch: inventoryBatch,
            remaining_central_stock: stock.units,
        });
    } catch (error) {
        if (session.inTransaction()) {
            await session.abortTransaction();
        }

        console.error("FAB allocation error:", error);

        return res.status(500).json({
            message: "Failed to allocate medicine to FAB",
            error: error.message,
        });
    } finally {
        await session.endSession();
    }
});

router.get("/allocations/:zone_id", async (req, res) => {
    try {
        const zoneId = Number(req.params.zone_id);

        if (Number.isNaN(zoneId)) {
            return res.status(400).json({
                message: "zone_id must be a valid number",
            });
        }

        const zone = await Zone.findOne({ id: zoneId });

        if (!zone) {
            return res.status(404).json({
                message: "Zone not found",
            });
        }

        const allocations = await FABAllocation.find({
            zone_id: zoneId,
        })
            .sort({ allocated_at: -1 })
            .lean();

        return res.json({
            zone_id: zoneId,
            zone_name: zone.zone_name,
            allocations,
        });
    } catch (error) {
        console.error("Get FAB allocation history error:", error);

        return res.status(500).json({
            message: "Failed to fetch FAB allocation history",
            error: error.message,
        });
    }
});

router.post("/consume", async (req, res) => {
    const session = await mongoose.startSession();

    try {
        const {
            zone_id,
            medicine_id,
            quantity,
            reason = "",
            consumed_by = "Unknown",
        } = req.body;

        if (!Number.isInteger(Number(zone_id))) {
            return res.status(400).json({
                message: "zone_id must be a valid number",
            });
        }

        if (!Number.isInteger(Number(medicine_id))) {
            return res.status(400).json({
                message: "medicine_id must be a valid number",
            });
        }

        if (!Number.isInteger(Number(quantity)) || Number(quantity) < 1) {
            return res.status(400).json({
                message: "quantity must be at least 1",
            });
        }

        const zoneId = Number(zone_id);
        const medicineId = Number(medicine_id);
        const consumptionQty = Number(quantity);

        const zone = await Zone.findOne({
            id: zoneId,
        }).session(session);

        if (!zone) {
            return res.status(404).json({
                message: "FAB/Zone not found",
            });
        }

        const medicine = await Medicines.findOne({
            id: medicineId,
        }).session(session);

        if (!medicine) {
            return res.status(404).json({
                message: "Medicine not found",
            });
        }

        const visit = await FABVisit.findOne({
            zone_id: zoneId,
            status: "OPEN",
        }).session(session);

        if (!visit) {
            return res.status(400).json({
                message: "No open visit found for this FAB",
            });
        }

        const inventoryBatches = await FABInventoryBatch.aggregate([
            {
                $match: {
                    zone_id: zoneId,
                    medicine_id: medicineId,
                    quantity: { $gt: 0 },
                },
            },
            {
                $addFields: {
                    fefo_expiry_order: {
                        $cond: [{ $eq: ["$expiry_date", null] }, 1, 0],
                    },
                },
            },
            {
                $sort: {
                    fefo_expiry_order: 1,
                    expiry_date: 1,
                    received_at: 1,
                },
            },
        ]);

        const totalAvailable = inventoryBatches.reduce(
            (total, batch) => total + batch.quantity,
            0,
        );

        if (totalAvailable < consumptionQty) {
            return res.status(400).json({
                message: "Insufficient FAB inventory",
                available_quantity: totalAvailable,
            });
        }

        session.startTransaction();

        let remainingToConsume = consumptionQty;
        const consumptionRecords = [];

        for (const batchData of inventoryBatches) {
            if (remainingToConsume <= 0) {
                break;
            }

            const batch = await FABInventoryBatch.findById(
                batchData._id,
            ).session(session);

            if (!batch || batch.quantity <= 0) {
                continue;
            }

            const quantityFromBatch = Math.min(
                batch.quantity,
                remainingToConsume,
            );

            const previousQuantity = batch.quantity;

            batch.quantity -= quantityFromBatch;

            await batch.save({ session });

            const consumption = new FABConsumption({
                visit_id: visit._id,
                zone_id: zoneId,
                medicine_id: medicineId,
                inventory_batch_id: batch._id,
                item_name: batch.item_name,
                brand: batch.brand || "",
                quantity: quantityFromBatch,
                expiry_date: batch.expiry_date || null,
                per_unit_cost: batch.per_unit_cost || 0,
                reason,
                consumed_by,
                consumed_at: new Date(),
            });

            await consumption.save({ session });

            consumptionRecords.push({
                consumption,
                inventory_batch_id: batch._id,
                previous_quantity: previousQuantity,
                remaining_quantity: batch.quantity,
            });

            remainingToConsume -= quantityFromBatch;
        }

        await session.commitTransaction();

        return res.status(201).json({
            message: "Medicine consumed from FAB successfully",
            consumed_quantity: consumptionQty,
            consumption_records: consumptionRecords,
        });
    } catch (error) {
        if (session.inTransaction()) {
            await session.abortTransaction();
        }

        console.error("FAB consumption error:", error);

        return res.status(500).json({
            message: "Failed to consume medicine from FAB",
            error: error.message,
        });
    } finally {
        await session.endSession();
    }
});

router.post("/stock-count", async (req, res) => {
    try {
        const {
            zone_id,
            counts,
            reason = "Physical stock count",
            counted_by = "Unknown",
        } = req.body;

        if (!Number.isInteger(Number(zone_id))) {
            return res.status(400).json({
                message: "zone_id must be a valid number",
            });
        }

        if (!Array.isArray(counts) || counts.length === 0) {
            return res.status(400).json({
                message: "counts must be a non-empty array",
            });
        }

        const zoneId = Number(zone_id);

        // --------------------------------------------------
        // 1. Verify FAB exists
        // --------------------------------------------------

        const zone = await Zone.findOne({
            id: zoneId,
        });

        if (!zone) {
            return res.status(404).json({
                message: "FAB/Zone not found",
            });
        }

        // --------------------------------------------------
        // 2. Verify an OPEN visit exists
        // --------------------------------------------------

        const visit = await FABVisit.findOne({
            zone_id: zoneId,
            status: "OPEN",
        });

        if (!visit) {
            return res.status(400).json({
                message: "No open visit found for this FAB",
            });
        }

        // --------------------------------------------------
        // 3. Validate counts
        // --------------------------------------------------

        for (const item of counts) {
            if (
                !Number.isInteger(Number(item.medicine_id)) ||
                !Number.isInteger(Number(item.counted_quantity)) ||
                Number(item.counted_quantity) < 0
            ) {
                return res.status(400).json({
                    message:
                        "Each count must contain a valid medicine_id and counted_quantity",
                });
            }
        }

        // --------------------------------------------------
        // 4. Get current FAB inventory
        // --------------------------------------------------

        const inventoryBatches = await FABInventoryBatch.find({
            zone_id: zoneId,
        }).lean();

        const currentQuantities = new Map();

        for (const batch of inventoryBatches) {
            const current = currentQuantities.get(batch.medicine_id) || 0;

            currentQuantities.set(batch.medicine_id, current + batch.quantity);
        }

        // --------------------------------------------------
        // 5. Process each physical count
        // --------------------------------------------------

        const results = [];

        for (const item of counts) {
            const medicineId = Number(item.medicine_id);
            const countedQuantity = Number(item.counted_quantity);

            const currentQuantity = currentQuantities.get(medicineId) || 0;

            const difference = currentQuantity - countedQuantity;

            // No change
            if (difference === 0) {
                results.push({
                    medicine_id: medicineId,
                    previous_quantity: currentQuantity,
                    counted_quantity: countedQuantity,
                    consumed_quantity: 0,
                    status: "NO_CHANGE",
                });

                continue;
            }

            // Physical count cannot currently identify which
            // batch an overage belongs to.
            if (difference < 0) {
                return res.status(400).json({
                    message: `Physical count for medicine ${medicineId} is greater than the system quantity. Use a batch adjustment for this overage.`,
                    medicine_id: medicineId,
                    system_quantity: currentQuantity,
                    counted_quantity: countedQuantity,
                });
            }

            // --------------------------------------------------
            // Consume the difference using FEFO
            // --------------------------------------------------

            const batches = await FABInventoryBatch.find({
                zone_id: zoneId,
                medicine_id: medicineId,
                quantity: { $gt: 0 },
            }).sort({
                expiry_date: 1,
                received_at: 1,
            });

            let remainingToConsume = difference;
            const consumptionRecords = [];

            for (const batch of batches) {
                if (remainingToConsume <= 0) {
                    break;
                }

                const quantityFromBatch = Math.min(
                    batch.quantity,
                    remainingToConsume,
                );

                const previousQuantity = batch.quantity;

                batch.quantity -= quantityFromBatch;

                await batch.save();

                const consumption = new FABConsumption({
                    visit_id: visit._id,
                    zone_id: zoneId,
                    medicine_id: medicineId,
                    inventory_batch_id: batch._id,
                    item_name: batch.item_name,
                    brand: batch.brand || "",
                    quantity: quantityFromBatch,
                    expiry_date: batch.expiry_date || null,
                    per_unit_cost: batch.per_unit_cost || 0,
                    reason,
                    consumed_by: counted_by,
                    consumed_at: new Date(),
                });

                await consumption.save();

                consumptionRecords.push({
                    inventory_batch_id: batch._id,
                    previous_quantity: previousQuantity,
                    consumed_quantity: quantityFromBatch,
                    remaining_quantity: batch.quantity,
                });

                remainingToConsume -= quantityFromBatch;
            }

            if (remainingToConsume > 0) {
                return res.status(400).json({
                    message: `Unable to consume the full difference for medicine ${medicineId}.`,
                });
            }

            results.push({
                medicine_id: medicineId,
                previous_quantity: currentQuantity,
                counted_quantity: countedQuantity,
                consumed_quantity: difference,
                status: "CONSUMED",
                consumption_records: consumptionRecords,
            });
        }

        return res.status(201).json({
            message: "FAB stock count saved successfully",
            visit_id: visit._id,
            zone_id: zoneId,
            results,
        });
    } catch (error) {
        console.error("FAB stock count error:", error);

        return res.status(500).json({
            message: "Failed to save FAB stock count",
            error: error.message,
        });
    }
});

router.get("/consumption/:zone_id", async (req, res) => {
    try {
        const zoneId = Number(req.params.zone_id);

        if (Number.isNaN(zoneId)) {
            return res.status(400).json({
                message: "zone_id must be a valid number",
            });
        }

        const zone = await Zone.findOne({ id: zoneId });

        if (!zone) {
            return res.status(404).json({
                message: "Zone not found",
            });
        }

        const consumption = await FABConsumption.find({
            zone_id: zoneId,
        })
            .sort({ consumed_at: -1 })
            .lean();

        return res.json({
            zone_id: zoneId,
            zone_name: zone.zone_name,
            consumption,
        });
    } catch (error) {
        console.error("Get FAB consumption history error:", error);

        return res.status(500).json({
            message: "Failed to fetch FAB consumption history",
            error: error.message,
        });
    }
});

router.post("/adjustment", async (req, res) => {
    const session = await mongoose.startSession();

    try {
        const {
            zone_id,
            medicine_id,
            inventory_batch_id,
            new_quantity,
            reason,
            adjusted_by,
        } = req.body;

        if (
            zone_id === undefined ||
            medicine_id === undefined ||
            !inventory_batch_id ||
            new_quantity === undefined ||
            !reason
        ) {
            return res.status(400).json({
                message:
                    "zone_id, medicine_id, inventory_batch_id, new_quantity and reason are required",
            });
        }

        if (new_quantity < 0) {
            return res.status(400).json({
                message: "new_quantity cannot be negative",
            });
        }

        await session.startTransaction();

        const batch = await FABInventoryBatch.findOne({
            _id: inventory_batch_id,
            zone_id,
            medicine_id,
        }).session(session);

        if (!batch) {
            await session.abortTransaction();

            return res.status(404).json({
                message: "FAB inventory batch not found",
            });
        }

        const previousQuantity = batch.quantity;
        const difference = new_quantity - previousQuantity;

        if (difference === 0) {
            await session.abortTransaction();

            return res.status(400).json({
                message: "New quantity is the same as the current quantity",
            });
        }

        batch.quantity = new_quantity;

        await batch.save({ session });

        const adjustment = new FABInventoryAdjustment({
            zone_id,
            medicine_id,
            inventory_batch_id: batch._id,
            previous_quantity: previousQuantity,
            new_quantity,
            difference,
            reason,
            adjusted_by: adjusted_by || "Unknown",
            adjusted_at: new Date(),
        });

        await adjustment.save({ session });

        await session.commitTransaction();

        res.status(200).json({
            message: "FAB inventory adjusted successfully",
            adjustment,
            inventory_batch: batch,
        });
    } catch (error) {
        await session.abortTransaction();

        console.error("FAB adjustment error:", error);

        res.status(500).json({
            message: "Failed to adjust FAB inventory",
            error: error.message,
        });
    } finally {
        session.endSession();
    }
});

router.get("/adjustments/:zone_id", async (req, res) => {
    try {
        const zoneId = Number(req.params.zone_id);

        if (Number.isNaN(zoneId)) {
            return res.status(400).json({
                message: "zone_id must be a valid number",
            });
        }

        const zone = await Zone.findOne({ id: zoneId });

        if (!zone) {
            return res.status(404).json({
                message: "Zone not found",
            });
        }

        const adjustments = await FABInventoryAdjustment.find({
            zone_id: zoneId,
        })
            .sort({ adjusted_at: -1 })
            .lean();

        return res.json({
            zone_id: zoneId,
            zone_name: zone.zone_name,
            adjustments,
        });
    } catch (error) {
        console.error("Get FAB adjustment history error:", error);

        return res.status(500).json({
            message: "Failed to fetch FAB adjustment history",
            error: error.message,
        });
    }
});

export default router;
