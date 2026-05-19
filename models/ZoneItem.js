// models/ZoneItem.js
import mongoose from "mongoose";

const zoneItemSchema = new mongoose.Schema({
  zone_id: { type: Number },
  medicine_id: { type: Number },

  item_name: {type: String},
  brand: {type: String},
  category: {type: String},
  default_quantity: { type: Number },

  quantity: { type: Number, default: 0 },

  expiry_date: {type: Date},
  is_expired: {
    type: Boolean,
    default: false
},
  last_replaced: {type: Date}
});

zoneItemSchema.index(
  { zone_id: 1, medicine_id: 1 },
  { unique: true }
);

zoneItemSchema.index({
    expiry_date: 1
});

zoneItemSchema.index({
    is_expired: 1
});

export default mongoose.model("ZoneItem", zoneItemSchema);