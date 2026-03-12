// models/Zone.js
import mongoose from "mongoose";
import Counter from "./Counter.js";

const zoneSchema = new mongoose.Schema({
  id: { type: Number, unique: true },
  zone_name: { type: String, required: true },
  location: { type: String }
});

zoneSchema.pre("save", async function () {
  if (this.id) return;

  const counter = await Counter.findOneAndUpdate(
    { name: "zone_id" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  this.id = counter.seq;
});

export default mongoose.model("Zone", zoneSchema);