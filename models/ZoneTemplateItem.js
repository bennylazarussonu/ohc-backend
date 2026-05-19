// models/ZoneTemplateItem.js

import mongoose from "mongoose";

const zoneTemplateItemSchema = new mongoose.Schema({

    zone_id: {
        type: Number,
        required: true
    },

    medicine_id: {
        type: Number,
        required: true
    },

    default_quantity: {
        type: Number,
        default: 0
    }

});

zoneTemplateItemSchema.index(
    {
        zone_id: 1,
        medicine_id: 1
    },
    {
        unique: true
    }
);

export default mongoose.model(
    "ZoneTemplateItem",
    zoneTemplateItemSchema
);