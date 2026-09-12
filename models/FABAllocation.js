import mongoose from "mongoose";

const fabAllocationSchema = new mongoose.Schema(
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

        // The central Stock document from which
        // this medicine was allocated.
        stock_id: {
            type: Number,
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

        allocated_by: {
            type: String,
            default: "Unknown"
        },

        allocated_at: {
            type: Date,
            default: Date.now
        }
    },
    {
        timestamps: true
    }
);

// Find all allocations made to a particular FAB.
fabAllocationSchema.index({
    zone_id: 1,
    allocated_at: -1
});

// Find all allocations belonging to a particular visit.
fabAllocationSchema.index({
    visit_id: 1
});

// Find allocation history for a particular medicine.
fabAllocationSchema.index({
    zone_id: 1,
    medicine_id: 1,
    allocated_at: -1
});

export default mongoose.model(
    "FABAllocation",
    fabAllocationSchema
);