import mongoose from "mongoose";
import Counter from "./Counter.js";

const FCACCSchema = new mongoose.Schema({
    id: { type: Number, unique: true },
    worker_id: { type: Number},
    date_of_medical_examination: { type: Date, default: Date.now, required: true },
    date_of_issuance_of_certificate_for_competency_clearance: { type: Date },
    competency_assessment_by: { type: String },
    examination_findings: {
        general_examination: {
            type: String,
            default: "FAIR"
        },
        pulse: {
            type: Number
        },
        blood_pressure: {
            systolic: { type: Number },
            diastolic: { type: Number }
        },
        spo2: {
            type: Number
        },
        height: { type: Number },
        weight: { type: Number },
        vertigo_test_passed: { type: Boolean, default: true }
    }
});

FCACCSchema.pre("save", async function(){
    if(this.id) return;

    const counter = await Counter.findOneAndUpdate(
        { name: "fcacc_id" },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
    );
    this.id = counter.seq;
});

export default mongoose.model("FCACC", FCACCSchema);