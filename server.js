import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import workerRoutes from './routes/workerRoutes.js';
import medicineRoutes from './routes/medicineRoutes.js';
import opdRoutes from './routes/opdRoutes.js';
import prescriptionRoutes from './routes/prescriptionRoutes.js';
import doctorRoutes from './routes/doctorRoutes.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import preEmploymentRoutes from "./routes/preEmploymentRoutes.js";
import idRenewalRoutes from './routes/idRenewalRoutes.js';
import { startWorkerExpiryJob } from './jobs/expireWorker.js';
import dashboardsRoutes from './routes/dashboardRoutes.js';
import buListRoutes from './routes/buListRoutes.js';
import procurementRoutes from './routes/procurementRoutes.js';
import stockRoutes from "./routes/stockRoutes.js";
import dispenseRoutes from "./routes/dispenseRoutes.js";
import adjustmentRoutes from "./routes/adjustmentRoutes.js";
import notificationsRoute from "./routes/notificationRoutes.js";
import Notifications from './models/Notifications.js';
import fcaccRoutes from './routes/fcaccRoutes.js';


import dotenv from 'dotenv';
dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/workers", workerRoutes);
app.use("/api/medicines", medicineRoutes);
app.use("/api/opds", opdRoutes);
app.use("/api/prescriptions", prescriptionRoutes);
app.use("/api/doctors", doctorRoutes);
app.use("/api/pre-employment", preEmploymentRoutes);
app.use("/api/id-renewal", idRenewalRoutes);
app.use("/api/dashboard", dashboardsRoutes);
app.use("/api/bulist", buListRoutes);
app.use("/api/procurement", procurementRoutes);
app.use("/api/stock", stockRoutes);
app.use("/api/dispense", dispenseRoutes);
app.use("/api/adjustment", adjustmentRoutes);
app.use("/api/notifications", notificationsRoute);
app.use("/api/fcacc", fcaccRoutes);

startWorkerExpiryJob();

app.get("/", (request, response) => {
    try{
        response.json({ message: "Hello from Dream backend!" });
    }catch(error){
        response.status(500).json({ error: "Internal Server Error" });
    }
});

mongoose.connect(process.env.MONGODB_URI).then(() => {
    console.log("Connected to MongoDB");
    // setInterval(async () => {
    //     try {
    //         const result = await Notifications.updateMany(
    //             {
    //                 status: "active",
    //                 expires_at: { $lt: new Date() }
    //             },
    //             {
    //                 status: "inactive",
    //                 expired_at: new Date()
    //             }
    //         );

    //         if (result.modifiedCount > 0) {
    //             console.log(`Expired ${result.modifiedCount} notifications`);
    //         }
    //     } catch (err) {
    //         console.error("Notification expiry job error:", err);
    //     }
    // }, 60000);
}).catch((error) => {
    console.error("Error connecting to MongoDB:", error);
});

app.listen(process.env.BACKEND_PORT, () => {
    console.log(`Server is running on port ${process.env.BACKEND_PORT}`);
});
