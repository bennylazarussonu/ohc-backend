import mongoose from "mongoose";

const fabInventoryAdjustmentSchema = new mongoose.Schema(
    {
        zone_id: {
            type: Number,
            required: true
        },

        medicine_id: {
            type: Number,
            required: true
        },

        inventory_batch_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "FABInventoryBatch",
            required: true
        },

        previous_quantity: {
            type: Number,
            required: true,
            min: 0
        },

        new_quantity: {
            type: Number,
            required: true,
            min: 0
        },

        difference: {
            type: Number,
            required: true
        },

        reason: {
            type: String,
            required: true,
            trim: true
        },

        adjusted_by: {
            type: String,
            default: "Unknown"
        },

        adjusted_at: {
            type: Date,
            default: Date.now
        }
    },
    {
        timestamps: true
    }
);

// Find adjustment history for a FAB.
fabInventoryAdjustmentSchema.index({
    zone_id: 1,
    adjusted_at: -1
});

// Find adjustments for a particular medicine.
fabInventoryAdjustmentSchema.index({
    zone_id: 1,
    medicine_id: 1,
    adjusted_at: -1
});

// Find all adjustments made to a particular inventory batch.
fabInventoryAdjustmentSchema.index({
    inventory_batch_id: 1,
    adjusted_at: -1
});

export default mongoose.model(
    "FABInventoryAdjustment",
    fabInventoryAdjustmentSchema
);