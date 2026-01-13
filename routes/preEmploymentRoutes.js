import express from 'express';
import { protect, allowRoles } from "../middlewares/auth.js";
import PreEmployment from '../models/PreEmployment.js';
import Worker from '../models/Worker.js';

const router = express.Router();

router.post("/add", protect, async (req, res) => {
  try {
    const record = await PreEmployment.create({
      ...req.body,
      status: "On-Going"
    });

    res.status(201).json(record);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


router.get("/on-going", protect, async (req, res) => {
  const list = await PreEmployment.find({ 
    $and: [
      { 
        $or: [
          {"opthalmic_examination.status" : "Not Done"},
          {"physical_parameters.status": "Not Done"},
        ]
      },
      {
        "status": "On-Going"
      }
    ],
  })
    .select("id name aadhar_no physical_parameters.status opthalmic_examination.status");

  res.json(list);
});

router.get("/vitals/:id", protect, async (req, res) => {
  try{
  const vitals= await PreEmployment.findOne({id: req.params.id}).select("id physical_parameters");
  res.json(vitals);
  }catch(err){
    console.log(err);
  }
});

router.get("/vision/:id", protect, async (req, res) => {
  try{
    const vision = await PreEmployment.findOne({id: req.params.id}).select("id opthalmic_examination");
    res.json(vision);
  }catch(err){
    console.log(err);
  }
});

router.put("/:id/vitals", protect, async (req, res) => {
  console.log("Vitals payload: ", req.body);
  await PreEmployment.updateOne(
    { id: req.params.id },
    {
      $set: {
        physical_parameters: {
          ...req.body,
          status: "Done"
        }
      }
    }
  );

  res.json({ message: "Vitals updated" });
});


router.put("/:id/vision", protect, async (req, res) => {
  await PreEmployment.updateOne(
    { id: req.params.id },
    {
      $set: {
        opthalmic_examination: {
          ...req.body,
          status: "Done"
        }
      }
    }
  );

  res.json({ message: "Vision updated" });
});


router.get("/completed", protect, async (req, res) => {
  const list = await PreEmployment.find({
    "physical_parameters.status": "Done",
    "opthalmic_examination.status": "Done",
    "status": "On-Going"
  });

  res.json(list);
});

router.get("/unfit", protect, async(req, res) => {
  const list = await PreEmployment.find({
    "status": "Declared Unfit"
  });
  res.json(list);
})
router.get("/fit", protect, async(req, res) => {
  const list = await PreEmployment.find({
    "status": "Declared Fit"
  });
  res.json(list);
})

router.post("/finalize", protect, async (req, res) => {
  try {
    const { preemployment_id, duty_fit, medical_examiner_id, ...reportData } = req.body;

    if (!preemployment_id || duty_fit === undefined) {
      return res.status(400).json({ message: "Missing preemployment_id or duty_fit" });
    }

    // ✅ Fix 1: Use custom ID field
    const preEmp = await PreEmployment.findOne({ id: preemployment_id });
    if (!preEmp) {
      return res.status(404).json({ message: "Pre-employment record not found" });
    }

    // ✅ Fix 2: Use req.body fields directly
    preEmp.name = reportData.name;
    preEmp.fathers_name = reportData.fathers_name;
    preEmp.employee_id = reportData.employee_id;
    preEmp.aadhar_no = reportData.aadhar_no;
    preEmp.gender = reportData.gender;
    preEmp.dob = reportData.dob;
    preEmp.residence = reportData.residence;
    preEmp.phone_no = reportData.phone_no;
    preEmp.designation = reportData.designation;
    preEmp.contractor_name = reportData.contractor_name;
    preEmp.date_of_joining = reportData.date_of_joining;
    preEmp.identification_marks = reportData.identification_marks;
    preEmp.presentation = reportData.presentation;
    preEmp.physical_examination = reportData.physical_examination;
    preEmp.general_examination = reportData.general_examination;
    preEmp.clinical_impression = reportData.clinical_impression;
    preEmp.final_recommendation = reportData.final_recommendation;
    preEmp.systemic_examination = reportData.systemic_examination;
    preEmp.physical_fitness = reportData.physical_fitness;  // Add this
    preEmp.physical_parameters = reportData.physical_parameters;
    preEmp.opthalmic_examination = reportData.opthalmic_examination;
    preEmp.medical_examiner_id = medical_examiner_id;
    preEmp.duty_fit = duty_fit;
    preEmp.status = duty_fit ? "Declared Fit" : "Declared Unfit";

    await preEmp.save();

    let worker = null;
    if (duty_fit === true) {
      // ✅ Fix 3: Check if worker already exists
      worker = await Worker.findOne({ preemployment_id: preEmp.id });
      if (!worker) {
        worker = new Worker({
          name: preEmp.name,
          employee_id: preEmp.employee_id,
          fathers_name: preEmp.fathers_name,
          aadhar_no: preEmp.aadhar_no,
          gender: preEmp.gender,
          dob: preEmp.dob,
          phone_no: preEmp.phone_no,
          designation: preEmp.designation,
          contractor_name: preEmp.contractor_name,
          date_of_joining: preEmp.date_of_joining,
          identification_marks: preEmp.identification_marks,
          preemployment_id: preEmp.id, // Use Mongo _id here
          last_id_renewal_date: preEmp.date_of_examination,
          id_status: "Active"
        });
        await worker.save();
      }
    }

    res.json({
      message: "Pre-employment finalized successfully",
      status: preEmp.status,
      worker_created: !!worker,
      worker
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

router.put("/send-back", protect, async(req, res) => {
  try{
      const {preemployment_id, ...reportData} = req.body;
      console.log(preemployment_id);
      console.log(reportData);

  const preEmp = await PreEmployment.findOne({id: preemployment_id});
  // console.log(preEmp);
  if (!preEmp) {
      return res.status(404).json({ message: "Pre-employment record not found" });
    }

    preEmp.physical_parameters['status'] = "Not Done";
    preEmp.opthalmic_examination['status'] = "Not Done";
    await preEmp.save();
    res.json({
      message: "Sent back to Examination Parameters",
      status: preEmp.status,
    });
  }catch(err){
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
})

router.put("/cancel", protect, async(req, res) => {
  try{
    const {preemployment_id, ...reportData} = req.body;

    const preEmp = await PreEmployment.findOne({id: preemployment_id});
    if (!preEmp) {
      return res.status(404).json({ message: "Pre-employment record not found" });
    }
    preEmp.status = "Cancelled";
    await preEmp.save();
    res.json({
      message: "Status set to Cancelled",
      status: preEmp.status,
    });
  }catch(err){
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

router.get("/cancelled", protect, async (req, res) => {
  try{
    const list = await PreEmployment.find({
      status: "Cancelled"
    });

    res.json(list);
  }catch(err){
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

router.put("/revoke", protect, async(req, res) => {
    try{
      const {preemployment_id, ...reportData} = req.body;

      const preEmp = await PreEmployment.findOne({id: preemployment_id});
      if (!preEmp) {
        return res.status(404).json({ message: "Pre-employment record not found" });
      }

      preEmp.status = "On-Going";
      await preEmp.save();
      res.json({
        message: "Revoked from Cancellation",
        status: preEmp.status,
      });
    }catch(err){
      console.error(err);
      res.status(500).json({ message: "Server error", error: err.message });
    }
})

export default router;

