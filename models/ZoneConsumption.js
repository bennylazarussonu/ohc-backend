// models/ZoneConsumption.js

import mongoose from "mongoose";
import Counter from "./Counter.js";

const zoneConsumptionSchema = new mongoose.Schema({
id: {type: Number, unique: true},
  zone_id: {type: Number},
  medicine_id: {type: Number},

  quantity: {type: Number},

  reason: {
    type: String,
    enum: ["USED","EXPIRED","REPLACED"],
    default: "REPLACED"
  },

  date: {
    type: Date,
    default: Date.now
  }

});

zoneConsumptionSchema.pre("save", async function(){
    if (this.id) return;

    const counter = await Counter.findOneAndUpdate(
        {name: "zone_consumption_id"},
        { $inc: {seq: 1}},
        { new: true, upsert: true}
    );

    this.id = counter.seq;
})

export default mongoose.model("ZoneConsumption", zoneConsumptionSchema);