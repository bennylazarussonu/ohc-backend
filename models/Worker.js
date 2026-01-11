import mongoose from "mongoose";
import Counter from "./Counter.js";

const workerSchema = new mongoose.Schema({
    id: { type: Number, unique: true },
    name: { type: String, uppercase: true, required: true },
    employee_id: { type: String},
    fathers_name: { type: String, uppercase: true },
    aadhar_no: { type: String},
    gender: {type: String, uppercase: true, default: "MALE"},
    dob: { type: Date },
    residence: { type: String },
    weight: {type: Number },
    phone_no: { type: String },
    designation: { type: String, uppercase: true },
    contractor_name: { type: String, uppercase: true },
    date_of_joining: { type: Date},
    identification_marks: { type: [String]},
    last_id_renewal_date: { type: Date },
    id_status: {type: String, enum: ["Expired", "Active"]},
    preemployment_id: { type: Number }
});

workerSchema.pre("save", async function () {
    if(this.id) return ;

    const counter = await Counter.findOneAndUpdate(
    { name: "worker_id" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  this.id = counter.seq;
});


export default mongoose.model("Worker", workerSchema);