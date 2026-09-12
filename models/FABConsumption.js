import mongoose from "mongoose";

const fabConsumptionSchema = new mongoose.Schema(
    {
        visit_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "FABVisit",
            required: true
        },

        zone_id: {
            type: Number,
            required: true
        },

        medicine_id: {
            type: Number,
            required: true
        },

        // The exact FAB inventory batch from which
        // the medicine was consumed.
        inventory_batch_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "FABInventoryBatch",
            required: true
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
            min: 1
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

        reason: {
            type: String,
            default: ""
        },

        consumed_by: {
            type: String,
            default: "Unknown"
        },

        consumed_at: {
            type: Date,
            default: Date.now
        }
    },
    {
        timestamps: true
    }
);

// Find consumption history for a FAB.
fabConsumptionSchema.index({
    zone_id: 1,
    consumed_at: -1
});

// Find consumption history for a particular visit.
fabConsumptionSchema.index({
    visit_id: 1,
    consumed_at: -1
});

// Find consumption history for a particular medicine.
fabConsumptionSchema.index({
    zone_id: 1,
    medicine_id: 1,
    consumed_at: -1
});

// Find all consumption records associated with
// a particular inventory batch.
fabConsumptionSchema.index({
    inventory_batch_id: 1
});

export default mongoose.model(
    "FABConsumption",
    fabConsumptionSchema
);