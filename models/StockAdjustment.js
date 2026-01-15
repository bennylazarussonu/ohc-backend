import mongoose from "mongoose";
import Counter from "./Counter.js";

const consumedItemSchema = new mongoose.Schema({
  stock_id: { type: Number, required: true },
  medicine_id: { type: Number },
  item_name: { type: String },
  brand: { type: String },
  consumed_units: { type: Number, required: true },
  from_date: { type: Date, required: true },
  to_date: { type: Date, required: true }
});

const stockAdjustmentSchema = new mongoose.Schema({
  id: { type: Number, unique: true },
  reason: { type: String, default: "OPENING_STOCK_RECONCILIATION" },
  adjusted_items: [consumedItemSchema],
  adjusted_on: { type: Date, default: Date.now },
  adjusted_by: {
    role: String,
    userId: String
  }
});

stockAdjustmentSchema.pre("save", async function () {
  if (this.id) return;

  const counter = await Counter.findOneAndUpdate(
    { name: "stock_adjustment_id" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  this.id = counter.seq;
});

export default mongoose.model("StockAdjustment", stockAdjustmentSchema);
