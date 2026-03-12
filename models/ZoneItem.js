// models/ZoneItem.js
import mongoose from "mongoose";

const zoneItemSchema = new mongoose.Schema({
  zone_id: { type: Number },
  medicine_id: { type: Number },

  item_name: {type: String},
  category: {type: String},

  quantity: { type: Number, default: 0 },

  expiry_date: {type: Date},
  last_replaced: {type: Date}
});

zoneItemSchema.index(
  { zone_id: 1, medicine_id: 1 },
  { unique: true }
);

export default mongoose.model("ZoneItem", zoneItemSchema);