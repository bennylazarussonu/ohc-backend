import mongoose from "mongoose";
import Counter from "./Counter.js";

const medicinesSchema = new mongoose.Schema({
    id: { type: Number, unique: true},
    drug_name_and_dose: { type: String, required: true },
    category: { type: String},
    sub_category: { type: String },
    brands: { type: [String] },
    route_of_administration: { type: String },
    frequency: { type: String, enum: ["OD", "BID", "stat", "As directed", "TID"]},
    frequency_description: {type: String, enum: [
        "1 time/day", 
        "1 time/day (at bedtime)", 
        "1 time/day (before breakfast)", 
        "1 time/day (evening)", 
        "1 time/day (morning)", 
        "1 time/day (same time daily)", 
        "1 time/day (single dose or as directed)", 
        "1 time/day (with food)", 
        "2 times/day", 
        "2 times/day (apply to affected area)", 
        "2 times/day (with meals)", 
        "3 times/day", 
        "3 times/day (with first bite of meal)", 
        "as directed", 
        "As per physician"]}
});

medicinesSchema.pre("save", async function (){
    if(this.id) return;

    const counter = await Counter.findOneAndUpdate(
        { name: "medicines_id" },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
    );

    this.id = counter.seq;
});

export default mongoose.model("Medicines", medicinesSchema);