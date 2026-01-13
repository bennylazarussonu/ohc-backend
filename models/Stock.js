import mongoose, { mongo } from "mongoose";
import Counter from "./Counter.js";

const stockSchema = new mongoose.Schema({
    id: { type: Number, unique: true},
    procurement_id: { type: Number },
    item_name: { type: String },
    brand: { type: String },
    units: { type: Number },
    per_unit_cost: { type: Number },
    expiry_date: { type: Date },
    procurement_date: { type: Date },
    medicine_id: { type: Number }
});

stockSchema.pre("save", async function () {
    if(this.id) return;

    const counter = await Counter.findOneAndUpdate(
        { name: "stock_id"},
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
    )

    this.id = counter.seq;
});

export default mongoose.model("Stock", stockSchema);

