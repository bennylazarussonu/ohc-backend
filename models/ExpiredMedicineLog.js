import mongoose from "mongoose";

const expiredMedicineLogSchema = new mongoose.Schema({
    source: {
        type: String,
        enum: ["CENTRAL_STOCK", "ZONE"],
        required: true
    },

    stock_id: {
        type: Number
    },

    zone_id: {
        type: Number
    },

    medicine_id: {
        type: Number
    },

    item_name: {
        type: String
    },

    brand: {
        type: String
    },

    expired_quantity: {
        type: Number,
        required: true
    },

    expiry_date: {
        type: Date
    },

    removed_at: {
        type: Date,
        default: Date.now
    }
});

export default mongoose.model(
    "ExpiredMedicineLog",
    expiredMedicineLogSchema
);