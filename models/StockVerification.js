import mongoose from "mongoose";
import Counter from "./Counter.js";

const stockVerificationSchema = new mongoose.Schema({
    id: {
        type: Number,
        unique: true
    },

    stock_id: {
        type: Number,
        required: true
    },

    verification_date: {
        type: Date,
        required: true
    },

    expected_units: {
        type: Number,
        required: true
    },

    physical_units: {
        type: Number,
        required: true
    },

    difference: {
        type: Number,
        required: true
    },

    status: {
        type: String,
        enum: ["VERIFIED", "DISPUTE"],
        required: true
    },

    verified_by: {
        role: String,
        userId: String
    },

    verified_on: {
        type: Date,
        default: Date.now
    }
});

stockVerificationSchema.pre("save", async function () {
    if (this.id) return;

    const counter = await Counter.findOneAndUpdate(
        { name: "stock_verification_id" },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
    );

    this.id = counter.seq;
});

stockVerificationSchema.index(
    {
        stock_id: 1,
        verification_date: 1
    },
    {
        unique: true
    }
);

export default mongoose.model(
    "StockVerification",
    stockVerificationSchema
);