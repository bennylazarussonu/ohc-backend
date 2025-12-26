import mongoose from 'mongoose';
import Counter from './Counter.js';

const prescriptionSchema = new mongoose.Schema({
    id: { type: Number, unique: true},
    opd_id: { type: Number, required: true, index: true },
    worker_id: { type: Number, required: true, index: true },
    medicine_id: { type: Number},
    drug_name_and_dose: {type: String},
    brand: { type: String},
    route_of_administration: {type: String},
    frequency: {type: String, enum: ["OD", "BID", "stat", "As directed", "TID"]},
    days: { type: Number},
});

prescriptionSchema.pre('save', async function () {
    if (this.id) return;

    const counter = await Counter.findOneAndUpdate(
        { name: 'prescription_id' },
        { $inc: { seq: 1 } },
        { new: true, upsert: true }
    );

    this.id = counter.seq;
});

export default mongoose.model('Prescription', prescriptionSchema);