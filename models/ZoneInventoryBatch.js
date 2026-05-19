// models/ZoneInventoryBatch.js

import mongoose from "mongoose";

const zoneInventoryBatchSchema =
    new mongoose.Schema({

        zone_id: {
            type: Number,
            required: true
        },

        medicine_id: {
            type: Number,
            required: true
        },

        stock_id: {
            type: Number,
            required: true
        },

        item_name: String,

        brand: String,

        quantity: {
            type: Number,
            default: 0
        },

        expiry_date: Date,

        per_unit_cost: Number,

        allocated_at: {
            type: Date,
            default: Date.now
        }

    });

zoneInventoryBatchSchema.index({
    zone_id: 1,
    medicine_id: 1
});

zoneInventoryBatchSchema.index({
    expiry_date: 1
});

export default mongoose.model(
    "ZoneInventoryBatch",
    zoneInventoryBatchSchema
);