import cron from "node-cron";

import Stock from "../models/Stock.js";
import ZoneItem from "../models/ZoneItem.js";
import ExpiredMedicineLog from "../models/ExpiredMedicineLog.js";

const startExpiryCron = () => {

    // runs everyday at 12:00 AM
    cron.schedule("30 20 * * *", async () => {

        console.log("Running expiry cleanup job...");
        console.log("Cron Executed: ", new Date().toLocaleString());
        try {

            // =========================
            // 1️⃣ CENTRAL STOCK
            // =========================

            const today = new Date();

today.setHours(0,0,0,0);
            const expiredStock = await Stock.find({
                expiry_date: { $lt: today },
                units: { $gt: 0 }
            });

            for (const stock of expiredStock) {

                await ExpiredMedicineLog.create({
                    source: "CENTRAL_STOCK",

                    stock_id: stock.id,

                    medicine_id: stock.medicine_id,

                    item_name: stock.item_name,

                    brand: stock.brand,

                    expired_quantity: stock.units,

                    expiry_date: stock.expiry_date
                });

                stock.units = 0;
                
                stock.is_expired = true;

                await stock.save();
            }

            // =========================
            // 2️⃣ ZONE ITEMS
            // =========================

            const expiredZoneItems = await ZoneItem.find({
    expiry_date: { $lt: today },
    quantity: { $gt: 0 }
});

            for (const item of expiredZoneItems) {

                await ExpiredMedicineLog.create({
                    source: "ZONE",

                    zone_id: item.zone_id,

                    medicine_id: item.medicine_id,

                    item_name: item.item_name,

                    brand: item.brand,

                    expired_quantity: item.quantity,

                    expiry_date: item.expiry_date
                });

                await ZoneConsumption.create({
    zone_id: item.zone_id,
    medicine_id: item.medicine_id,
    quantity: item.quantity,
    reason: "EXPIRED"
});

                item.quantity = 0;
                item.is_expired = true;

                await item.save();
            }

            console.log("Expiry cleanup completed");

        } catch (err) {

            console.error(
                "Expiry cron failed:",
                err
            );
        }

    });

};

export default startExpiryCron;