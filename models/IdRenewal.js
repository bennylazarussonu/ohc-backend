import mongoose from "mongoose";
import Counter from "./Counter.js";

const IdRenewalSchema = new mongoose.Schema({
    id: {type: Number, unique: true},
    worker_id: {type: Number},
    blood_group: {type: String, enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", ""], default: ""},
    date_of_renewal: {type: Date, default: Date.now, required: true},
    previous_renewal_date: {
        type: Date 
        // allowed only for first renewal or legacy workers
    },
    general_condition: {type: String, default: "FAIR"},
    pulse: {type: Number },
    blood_pressure: {
        systolic: {type: Number},
        diastolic: {type: Number}
    },
    spo2: {type: Number},
    height: {type: Number},
    weight: {type: Number},
    remarks: {type: String},
    vertigo_test_passed: {type: Boolean, default: true}
});

IdRenewalSchema.pre("save", async function() {
    if(this.id) return;

    const counter = await Counter.findOneAndUpdate(
        {name: "idrenewal_id"},
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
    );
    this.id = counter.seq;
});

export default mongoose.model("IdRenewal", IdRenewalSchema);