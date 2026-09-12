import mongoose from "mongoose";

const fabInventoryBatchSchema = new mongoose.Schema(
    {
        zone_id: {
            type: Number,
            required: true
        },

        medicine_id: {
            type: Number,
            required: true
        },

        // Where this stock came from.
        // OPENING = stock that was already physically present
        // CENTRAL_STOCK = stock subsequently allocated from central inventory
        source_type: {
            type: String,
            enum: ["OPENING", "CENTRAL_STOCK"],
            required: true
        },

        // ID of the source Stock document when the source
        // is CENTRAL_STOCK. Null for OPENING stock.
        source_id: {
            type: Number,
            default: null
        },

        item_name: {
            type: String,
            required: true
        },

        brand: {
            type: String,
            default: ""
        },

        quantity: {
            type: Number,
            required: true,
            min: 0
        },

        expiry_date: {
            type: Date,
            default: null
        },

        per_unit_cost: {
            type: Number,
            default: 0,
            min: 0
        },

        received_at: {
            type: Date,
            default: Date.now
        }
    },
    {
        timestamps: true
    }
);

// Quickly find all inventory batches belonging to a FAB.
fabInventoryBatchSchema.index({
    zone_id: 1
});

// Quickly find all batches for a particular medicine in a FAB.
fabInventoryBatchSchema.index({
    zone_id: 1,
    medicine_id: 1
});

// Useful for FEFO (First Expiry, First Out).
fabInventoryBatchSchema.index({
    zone_id: 1,
    medicine_id: 1,
    expiry_date: 1
});

export default mongoose.model(
    "FABInventoryBatch",
    fabInventoryBatchSchema
);