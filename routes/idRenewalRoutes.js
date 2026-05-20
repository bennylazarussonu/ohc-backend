import express from "express";
import { protect, allowRoles } from "../middlewares/auth.js";
import IdRenewal from "../models/IdRenewal.js";
import Worker from "../models/Worker.js";

const router = express.Router();

router.post("/add", protect, async (req, res) => {
    try {
        const record = await IdRenewal.create({
            ...req.body,
        });
        res.status(201).json(record);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// FOR PRODUCTION - Uncomment the below route when deploying or for production
router.post("/renew", protect, async (req, res) => {
    console.log("Hey");
    let session;

    try {
        session = await Worker.startSession();
        session.startTransaction();
        let {
            worker_id,
            blood_group,
            previous_renewal_date,
            general_condition,
            pulse,
            systolic,
            diastolic,
            spo2,
            height,
            weight,
            remarks,
            vertigo_test_passed,
            worker_data,
            opthalmic_examination,
            test_done_by
        } = req.body;

        if (!worker_id && !worker_data) {
            throw new Error("Either worker_id or worker_data must be provided");
        }

        let worker;
        let previousRenewalDate = null;

        // 🆕 New worker
        if (!worker_id && worker_data) {
            worker = await Worker.create(
                [
                    {
                        ...worker_data,
                        id_status: "Active",
                        last_id_renewal_date: new Date(),
                    },
                ],
                { session }
            );

            worker = worker[0];
            worker_id = worker.id;

            // user is allowed to provide history
            previousRenewalDate = previous_renewal_date ?? null;
        }

        // ♻️ Existing worker
        else if (worker_id) {
            const existingWorker = await Worker.findOne(
                { id: worker_id },
                null,
                { session }
            );

            if (!existingWorker) {
                throw new Error("Worker not found");
            }

            // 🔐 Decide source of truth
            if (existingWorker.last_id_renewal_date) {
                // history exists → ignore user input
                previousRenewalDate = existingWorker.last_id_renewal_date;
            } else {
                // legacy record → allow user input
                previousRenewalDate = previous_renewal_date ?? null;
            }

            worker = await Worker.findOneAndUpdate(
                { id: worker_id },
                {
                    id_status: "Active",
                    last_id_renewal_date: new Date(),
                },
                { new: true, session }
            );
        }

        // 1️⃣ Create ID Renewal record
        const renewal = await IdRenewal.create(
            [
                {
                    worker_id,
                    blood_group,
                    previous_renewal_date: previousRenewalDate ?? null,
                    general_condition,
                    pulse,
                    blood_pressure: {
                        systolic,
                        diastolic,
                    },
                    opthalmic_examination,
                    spo2,
                    height,
                    weight,
                    remarks,
                    vertigo_test_passed,
                    date_of_renewal: new Date(),
                    test_done_by
                },
            ],
            { session }
        );

        // 2️⃣ Update Worker status
        // const updatedWorker = await Worker.findOneAndUpdate(
        //     { id: worker_id },
        //     {
        //         id_status: "Active",
        //         last_id_renewal_date: new Date(),
        //     },
        //     { new: true, session }
        // );

        // if (!updatedWorker) {
        //     throw new Error("Worker not found");
        // }

        await session.commitTransaction();
        // session.endSession();

        res.status(201).json({
            message: "ID renewed successfully",
            renewal: renewal[0],
            worker,
        });
    } catch (err) {
        console.log(err);
        if(session) await session.abortTransaction();
        res.status(500).json({ message: err.message });
    }finally{
        if(session) session.endSession();
    }
});

// FOR LOCAL - Uncomment the below route when running locally
// router.post("/renew", protect, async (req, res) => {
//     try {
//         let {
//             worker_id,
//             blood_group,
//             previous_renewal_date,
//             general_condition,
//             pulse,
//             systolic,
//             diastolic,
//             spo2,
//             height,
//             weight,
//             remarks,
//             vertigo_test_passed,
//             worker_data,
//             opthalmic_examination,
//             test_done_by
//         } = req.body;
//         console.log(test_done_by);

//         if (!worker_id && !worker_data) {
//             return res.status(400).json({
//                 message: "Either worker_id or worker_data must be provided",
//             });
//         }

//         let worker;
//         let previousRenewalDate = null;

//         // 🆕 New worker
//         if (!worker_id && worker_data) {
//             worker = await Worker.create({
//                 ...worker_data,
//                 id_status: "Active",
//                 last_id_renewal_date: new Date(),
//             });

//             worker_id = worker.id || worker._id;

//             previousRenewalDate = previous_renewal_date ?? null;
//         }

//         // ♻️ Existing worker
//         else {
//             const existingWorker = await Worker.findOne({ id: worker_id });

//             if (!existingWorker) {
//                 return res.status(404).json({ message: "Worker not found" });
//             }

//             previousRenewalDate = existingWorker.last_id_renewal_date
//                 ? existingWorker.last_id_renewal_date
//                 : previous_renewal_date ?? null;

//             worker = await Worker.findOneAndUpdate(
//                 { id: worker_id },
//                 {
//                     id_status: "Active",
//                     last_id_renewal_date: new Date(),
//                 },
//                 { new: true }
//             );
//         }

//         // 📝 Create ID Renewal record
//         const renewal = await IdRenewal.create({
//             worker_id,
//             blood_group,
//             previous_renewal_date: previousRenewalDate,
//             general_condition,
//             pulse,
//             blood_pressure: {
//                 systolic,
//                 diastolic,
//             },
//             opthalmic_examination,
//             spo2,
//             height,
//             weight,
//             remarks,
//             vertigo_test_passed,
//             date_of_renewal: new Date(),
//             test_done_by
//         });

//         return res.status(201).json({
//             message: "ID renewed successfully",
//             renewal,
//             worker,
//         });
//     } catch (err) {
//         console.error(err);
//         return res.status(500).json({ message: err.message });
//     }
// });

router.get("/latest/:worker_id", protect, async (req, res) => {
    try {
        const latest = await IdRenewal.findOne({
            worker_id: Number(req.params.worker_id)
        }).sort({ date_of_renewal: -1 });

        if (!latest) {
            return res.status(404).json({
                message: "No previous renewal found"
            });
        }

        res.json(latest);

    } catch (err) {
        res.status(500).json({
            message: err.message
        });
    }
});

router.get("/list", protect, async (req, res) => {
    try {
        const renewals = await IdRenewal.find()
            .sort({ date_of_renewal: -1 })
            .lean();

        const workerIds = renewals.map(r => r.worker_id);

        const workers = await Worker.find({
            id: { $in: workerIds }
        }).lean();

        const workerMap = {};

        workers.forEach(worker => {
            workerMap[worker.id] = worker;
        });

        const finalData = renewals.map(renewal => ({
            ...renewal,
            worker: workerMap[renewal.worker_id] || null
        }));

        res.json(finalData);

    } catch (err) {
        console.log(err);
        res.status(500).json({
            message: err.message
        });
    }
});


export default router;
