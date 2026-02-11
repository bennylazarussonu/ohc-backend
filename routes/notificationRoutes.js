import express from "express";
import Notifications from "../models/Notifications.js";
import { protect, allowRoles } from "../middlewares/auth.js";

const router = express.Router();

// GET all
router.get("/active", protect, async (req, res) => {
  const notifications = await Notifications.find({status: "active"}).sort({ published_at: -1 });
  res.json(notifications);
});
router.get("/inactive", protect, async (req, res) => {
    const notifications = await Notifications.find({status: "inactive"}).sort({ published_at: -1 });
    res.json(notifications);
})
router.get("/", protect, async (req, res) => {
    const notifications = await Notifications.find().sort({ published_at: -1 });
    res.json(notifications);
})

// CREATE
router.post("/", protect, allowRoles("ADMIN"),async (req, res) => {
  const { title, message, expires_at } = req.body;

  const notification = new Notifications({
    title,
    message,
    expires_at, // if undefined → schema default applies
  });

  await notification.save();
  res.json(notification);
});

// UPDATE
router.put("/:id", protect, allowRoles("ADMIN"), async (req, res) => {
  const notification = await Notifications.findOne({ id: req.params.id });

  if (!notification) {
    return res.status(404).json({ message: "Notification not found" });
  }

  // If already inactive → no status changes allowed
  if (notification.status === "inactive") {
    return res.status(400).json({
      message: "Inactive notifications cannot be reactivated",
    });
  }

  // If request tries to set inactive
  if (req.body.status === "inactive") {
    notification.status = "inactive";
    notification.expired_at = new Date();
  }

  // Allow editing title/message only while active
  if (req.body.title) notification.title = req.body.title;
  if (req.body.message) notification.message = req.body.message;

  await notification.save();

  res.json(notification);
});


// DELETE
router.delete("/:id", protect, allowRoles("ADMIN"), async (req, res) => {
  const id = Number(req.params.id);

  const deleted = await Notifications.findOneAndDelete({ id });

  if (!deleted) {
    return res.status(404).json({ message: "Notification not found" });
  }

  res.json({ message: "Deleted" });
});

router.get("/active/count", protect, async (req, res) => {
  const count = await Notifications.countDocuments({ status: "active" });
  res.json({ count });
});




export default router;
