import Stock from "../models/Stock.js";
import StockAdjustment from "../models/StockAdjustment.js";
import express from "express";
import { protect } from "../middlewares/auth.js";

const router = express.Router();

router.post("/reconcile-opening", protect, async (req, res) => {
  try {
    const { from_date, to_date, items } = req.body;

    if (!items?.length) {
      return res.status(400).json({ message: "No items provided" });
    }

    const adjustedItems = [];

    for (const item of items) {
      const stock = await Stock.findOne({ id: item.stock_id });
      if (!stock) continue;

      const consumedUnits = stock.units - Number(item.remaining_units);

      if (consumedUnits < 0) {
        return res.status(400).json({
          message: `Remaining units cannot exceed current units for ${stock.item_name}`
        });
      }

      // 🔻 Update stock
      stock.units = Number(item.remaining_units);
      await stock.save();

      if (consumedUnits > 0) {
        adjustedItems.push({
          stock_id: stock.id,
          medicine_id: stock.medicine_id,
          item_name: stock.item_name,
          brand: stock.brand,
          consumed_units: consumedUnits,
          from_date,
          to_date
        });
      }
    }

    // 🧾 Save adjustment log
    const adjustment = new StockAdjustment({
      adjusted_items: adjustedItems,
      adjusted_by: {
        role: req.user.role,
        userId: req.user.userId
      }
    });

    await adjustment.save();

    res.json({
      success: true,
      message: "Opening stock reconciled successfully",
      adjustment
    });

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


export default router;