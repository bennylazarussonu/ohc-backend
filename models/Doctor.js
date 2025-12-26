import mongoose from "mongoose";
import Counter from "./Counter.js";

const doctorSchema = new mongoose.Schema({
    id: { type: Number, unique: true },
    name: { type: String, required: true },
    qualification: { type: String },
    designation: { type: String },
    regn_no: { type: String, unique: true },
});

doctorSchema.pre("save", async function () {
  if (this.id) return;

  const counter = await Counter.findOneAndUpdate(
    { name: "doctor_id" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  this.id = counter.seq;
});

export default mongoose.models.Doctor || mongoose.model("Doctor", doctorSchema);