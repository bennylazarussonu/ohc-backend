import mongoose from "mongoose";
import Counter from "./Counter.js";

const BUListSchema = new mongoose.Schema({
    id: { type: Number, unique: true },
    medicine_id: { type: Number },
    item_name: { type: String, required: true},
    category: { type: String },
    sub_category: { type: String },
    brands: { type: [String] }
})

BUListSchema.pre("save", async function () {
  if (this.id) return;

  const counter = await Counter.findOneAndUpdate(
    { name: "bulist_id" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  this.id = counter.seq;
});

export default mongoose.model("BUList", BUListSchema);