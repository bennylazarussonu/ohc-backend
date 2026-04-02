import express from "express";
import { protect } from "../middlewares/auth.js";
import FCACC from "../models/FCACC.js";
import Worker from "../models/Worker.js";

const router = express.Router();

router.get("/fitness-clearance", protect, async (req, res) => {
    try {
        const records = await FCACC.aggregate([
            {
                $lookup: {
                    from: "workers",          // collection name in MongoDB
                    localField: "worker_id",  // FCACC.worker_id
                    foreignField: "id",       // Worker.id
                    as: "worker_details"
                }
            },
            {
                $unwind: {
                    path: "$worker_details",
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $sort: { date_of_medical_examination: -1 }
            }
        ]);

        return res.status(200).json({ records });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: err.message });
    }
});

router.post("/fitness-clearance", protect, async (req, res) => {
    try {
        let {
            worker_id,
            date_of_issuance_of_certificate_for_competency_clearance,
            competency_assessment_by,
            general_examination,
            pulse,
            systolic,
            diastolic,
            spo2,
            height,
            weight,
            vertigo_test_passed,
            worker_data
        } = req.body;

        if (!worker_id && !worker_data){
            throw new Error("Either worker_id or worker_data must be provided");
        }

        let worker;

        if(!worker_id && worker_data){
            worker = await Worker.create({
                ...worker_data,
            });
            worker_id = worker.id || worker._id;
        }else if(worker_id){
            worker = await Worker.findOne({ id: worker_id });
            if(!worker){
                return res.status(404).json({ message: "Worker not found" });
            }
        }

        const fcacc = await FCACC.create({
                worker_id,
                date_of_issuance_of_certificate_for_competency_clearance,
                competency_assessment_by,
                examination_findings: {
                    general_examination,
                    pulse,
                    blood_pressure: {
                        systolic,
                        diastolic
                    },
                    spo2,
                    height,
                    weight,
                    vertigo_test_passed
                }
            });

            return res.status(201).json({ message: "FCACC record created successfully", fcacc, worker});
    }catch (err) {
        console.error(err);
        return res.status(500).json({ message: err.message });
    }
})

// UPDATE FCACC
router.put("/fitness-clearance/:id", protect, async (req, res) => {
    try {
        const { id } = req.params;

        const {
            competency_assessment_by,
            general_examination,
            pulse,
            systolic,
            diastolic,
            spo2,
            height,
            weight,
            vertigo_test_passed,
            date_of_issuance_of_certificate_for_competency_clearance
        } = req.body;

        const updated = await FCACC.findByIdAndUpdate(
            id,
            {
                competency_assessment_by,
                date_of_issuance_of_certificate_for_competency_clearance,
                examination_findings: {
                    general_examination,
                    pulse,
                    blood_pressure: {
                        systolic,
                        diastolic
                    },
                    spo2,
                    height,
                    weight,
                    vertigo_test_passed
                }
            },
            { new: true }
        );

        if (!updated) {
            return res.status(404).json({ message: "Record not found" });
        }

        res.json({ message: "FCACC updated", updated });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
});

export default router;