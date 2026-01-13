import mongoose, { mongo } from "mongoose";
import Counter from "./Counter.js";

const itemSchema = new mongoose.Schema({
    item_name: { type: String, required: true, uppercase: true },
    brand: { type: String, uppercase: true },
    units: { type: Number },
    rate_excluding_gst: { type: Number},
    gst_rate: { type: Number },
    rate_including_gst: { type: Number },
    item_total_cost: { type: Number },
    per_unit_cost: { type: Number },
    expiry_date: { type: Date },
    medicine_id: { type: Number }
})

const procurementSchema = new mongoose.Schema({
    id: { type: Number, unique: true},
    items: [itemSchema],
    total_cost: { type: Number },
    procured_from: { type: String, uppercase: true },
    procurement_date: { type: Date, default: Date.now, required: true }
})

procurementSchema.pre("save", async function () {
    if(this.id) return;

    const counter = await Counter.findOneAndUpdate(
        { name: "procurement_id" },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
    );

    this.id = counter.seq;
})

export default mongoose.model("Procurement", procurementSchema);