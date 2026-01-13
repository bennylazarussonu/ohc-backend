import mongoose from "mongoose";
import Counter from "./Counter.js";

const opdSchema = new mongoose.Schema({
    id: { type: Number, unique: true },
    worker_id: { type: Number, required: true, index: true },
    presenting_complaint: { type: String },
    exam_findings_and_clinical_notes: { type: String },
    weight: { type: String },
    temperature: { type: String },
    heart_rate: { type: Number },
    blood_pressure: { type: String },
    spo2: { type: Number },
    diagnosis: { type: String },
    investigations_recommended: { type: String },
    further_advice: { type: String },
    referral_advice: { type: String },
    created_at: { type: Date, default: Date.now },
    treating_doctor_id: { type: Number },
    other_recommendations: { type: String },
});

opdSchema.pre("save", async function () {
  if (this.id) return;

  const counter = await Counter.findOneAndUpdate(
    { name: "opd_id" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  this.id = counter.seq;
});


export default mongoose.models.OPD || mongoose.model("OPD", opdSchema);

