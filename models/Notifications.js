import mongoose from "mongoose";
import Counter from "./Counter.js";

const notificationsSchema = new mongoose.Schema({
    id: { type: Number, unique: true },
    title: { type: String, required: true },
    message: { type: String },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    published_at: { type: Date, default: Date.now, required: true },
    expires_at: {
  type: Date,
  required: true,
  default: () => new Date(Date.now() + 24 * 60 * 60 * 1000)
},
    expired_at: { type: Date, default: null},
});

notificationsSchema.pre("save", async function () {
  if (this.id) return;

  const counter = await Counter.findOneAndUpdate(
    { name: "notifications_id" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  this.id = counter.seq;
});

export default mongoose.model("Notifications", notificationsSchema);