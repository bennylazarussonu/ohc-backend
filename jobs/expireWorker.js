import cron from "node-cron";
import Worker from "../models/Worker.js";

export const startWorkerExpiryJob = () => {
  cron.schedule("0 2 * * *", async () => {
    try {
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    // const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);


      const result = await Worker.updateMany(
        {
          id_status: { $exists: true },
          id_status: "Active",
          last_id_renewal_date: { $lte: threeMonthsAgo },
        },
        {
          $set: { id_status: "Expired" },
        }
      );

      console.log(
        `[CRON] Worker expiry check complete. Expired: ${result.modifiedCount}`
      );
    } catch (err) {
      console.error("[CRON] Worker expiry job failed:", err);
    }
  });
};