import mongoose from "mongoose";
import Counter from "./Counter.js";

const itemSchema = new mongoose.Schema({
    stock_id: { type: Number },
    units: { type: Number }
});

const dispenseSchema = new mongoose.Schema({
    id: { type: Number, unique: true },
    opd_id: { type: Number },
    prescription_id: { type: Number },
    dispensed_items: [itemSchema],
    dispensed_to_worker_id: { type: Number },
    dispensed_by: { type: String },
    dispensed_on: { type: Date, default: Date.now, required: true }
});

dispenseSchema.pre("save", async function () {
    if(this.id) return;

    const counter = await Counter.findOneAndUpdate(
        { name: "dispense_id" },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
    );

    this.id = counter.seq;
});

export default mongoose.model("Dispense", dispenseSchema);