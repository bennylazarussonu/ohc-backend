import mongoose from "mongoose";
import Counter from "./Counter.js";

const MalariaSchema = new mongoose.Schema({
    id: {type: Number, unique: true},
    worker_id: {type: Number},
    date_of_test: {type: Date, default: Date.now, required: true},
    tested_by: {type: String, enum: ["BMC", "Diagnostic Lab"]}
});

MalariaSchema.pre("save", async function() {
    if(this.id) return;
    const counter = await Counter.findOneAndUpdate(
        {name: "malaria_id"},
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
    );
    this.id = counter.seq;
});

export default mongoose.model("Malaria", MalariaSchema);