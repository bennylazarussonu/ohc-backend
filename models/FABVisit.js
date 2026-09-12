import mongoose from "mongoose";

const fabVisitSchema = new mongoose.Schema(
    {
        zone_id: {
            type: Number,
            required: true
        },

        status: {
            type: String,
            enum: ["OPEN", "CLOSED"],
            default: "OPEN",
            required: true
        },

        started_at: {
            type: Date,
            default: Date.now,
            required: true
        },

        closed_at: {
            type: Date,
            default: null
        },

        started_by: {
            type: String,
            default: "Unknown"
        },

        closed_by: {
            type: String,
            default: null
        }
    },
    {
        timestamps: true
    }
);

// Quickly find visits belonging to a FAB.
fabVisitSchema.index({
    zone_id: 1,
    started_at: -1
});

// A FAB can have only one active visit at a time.
fabVisitSchema.index(
    {
        zone_id: 1,
        status: 1
    },
    {
        unique: true,
        partialFilterExpression: {
            status: "OPEN"
        }
    }
);

export default mongoose.model(
    "FABVisit",
    fabVisitSchema
);