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
}).catch((error) => {
    console.error("Error connecting to MongoDB:", error);
});

app.listen(process.env.BACKEND_PORT, () => {
    console.log(`Server is running on port ${process.env.BACKEND_PORT}`);
});