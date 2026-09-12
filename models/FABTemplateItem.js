import mongoose from "mongoose";

const fabTemplateItemSchema = new mongoose.Schema(
    {
        zone_id: {
            type: Number,
            required: true
        },

        medicine_id: {
            type: Number,
            required: true
        },

        required_quantity: {
            type: Number,
            required: true,
            min: 1
        }
    },
    {
        timestamps: true
    }
);

// A medicine can appear only once in a particular FAB.
fabTemplateItemSchema.index(
    {
        zone_id: 1,
        medicine_id: 1
    },
    {
        unique: true
    }
);

export default mongoose.model(
    "FABTemplateItem",
    fabTemplateItemSchema
);