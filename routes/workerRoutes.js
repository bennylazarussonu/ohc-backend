import express from "express";
import multer from "multer";
import xlsx from "xlsx";
import Worker from "../models/Worker.js";
import Counter from "../models/Counter.js";
import { protect, allowRoles } from "../middlewares/auth.js";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

function toDateOnly(dateStr) {
  const d = new Date(dateStr);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function toUpper(str) {
    return typeof str === "string" ? str.toUpperCase().trim() : str;
}


function excelDateToJSDate(value) {
  if (!value) return undefined;

  // Case 1: JS Date (Excel or already parsed)
  if (value instanceof Date) {
    return new Date(
      value.getFullYear(),
      value.getMonth(),
      value.getDate()
    );
  }

  // Case 2: Excel serial number
  if (typeof value === "number") {
    const d = new Date((value - 25569) * 86400 * 1000);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  // Case 3: String
  if (typeof value === "string") {

    // ✅ YYYY-MM-DD (from <input type="date">)
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [yyyy, mm, dd] = value.split("-");
      return new Date(Number(yyyy), Number(mm) - 1, Number(dd));
    }

    // ✅ DD-MM-YYYY or DD/MM/YYYY (Excel text)
    if (/^\d{2}[-/]\d{2}[-/]\d{4}$/.test(value)) {
      const normalized = value.replace(/\//g, "-");
      const [dd, mm, yyyy] = normalized.split("-");
      return new Date(Number(yyyy), Number(mm) - 1, Number(dd));
    }
  }

  return undefined;
}




router.get("/", protect, allowRoles("ADMIN", "DOCTOR", "EMPLOYEE"), async (req, res) => {
    try {
        const workers = await Worker.find().sort({name: 1});
        res.json(workers);
    }catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post("/add", protect, allowRoles("ADMIN", "DOCTOR", "EMPLOYEE"), async (req, res) => {
  try {
    const {
      name,
      employee_id,
      fathers_name,
      aadhar_no,
      gender,
      dob,
      weight,
      phone_no,
      designation,
      contractor_name,
      date_of_joining
    } = req.body;

    // 1️⃣ Basic validation
    if (!name) {
      return res.status(400).json({
        message: "Name is required"
      });
    }

    // 2️⃣ Prevent duplicates (real-world rules)
    // const duplicate = await Worker.findOne({ aadhar_no: aadhar_no });

    // if (duplicate) {
    //   return res.status(400).json({
    //     message: "Worker already exists (Aadhaar)"
    //   });
    // }

    // 4️⃣ Create worker
    const worker = new Worker({
      name: toUpper(name),
      employee_id: String(employee_id).trim(),
      fathers_name: toUpper(fathers_name),
      aadhar_no: String(aadhar_no).trim(),
      gender: toUpper(gender),
      dob: dob ? excelDateToJSDate(dob) : undefined,
      weight: weight ? Number(weight) : undefined,
      phone_no: String(phone_no).trim(),
      designation: toUpper(designation),
      contractor_name: toUpper(contractor_name),
      date_of_joining: date_of_joining ? excelDateToJSDate(date_of_joining) : undefined
    });

    await worker.save();

    res.status(201).json(worker);

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// router.get("/search", protect, allowRoles("ADMIN", "DOCTOR", "EMPLOYEE"), async (req, res) => {
//   try {
//     const q = req.query.q;
//     if (!q || q.length < 2) return res.json([]);

//     const regex = new RegExp(q, "i");

//     const workers = await Worker.find({
//       $or: [
//         { name: regex },
//         { employee_id: regex },
//         { fathers_name: regex },
//         { aadhar_no: regex },
//         { phone_no: regex },
//         { designation: regex }
//       ]
//     })
//       // .limit(20)              // 🔥 critical
//       .sort({ name: 1 });

//     res.json(workers);
//   } catch (err) {
//     res.status(500).json({ message: err.message });
//   }
// });

router.get("/search", protect, async (req, res) => {
  try {
    const q = req.query.q?.trim();
    if (!q) return res.json([]);

    // 🔹 Case 1: comma-based structured search
    if (q.includes(",")) {
      const parts = q
        .split(",")
        .map(p => p.trim())
        .map(p => (p ? new RegExp(p, "i") : null));

      const [name, empId, father, aadhar, phone] = parts;

      const workers = await Worker.find({
        ...(name && { name }),
        ...(empId && { employee_id: empId }),
        ...(father && { fathers_name: father }),
        ...(aadhar && { aadhar_no: aadhar }),
        ...(phone && { phone_no: phone })
      });

      return res.json(workers);
    }

    // 🔹 Case 2: single-value smart search (OR)
    const regex = new RegExp(q, "i");

    const workers = await Worker.find({
      $or: [
        { name: regex },
        { employee_id: regex },
        { fathers_name: regex },
        { aadhar_no: regex },
        { phone_no: regex },
        { designation: regex },
        { contractor_name: regex }
      ]
    });

    res.json(workers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});





router.post("/bulk", protect, allowRoles("ADMIN", "DOCTOR", "EMPLOYEE"), upload.single("file"), async (req, res) => {
  try {
    const workbook = xlsx.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(sheet);

    const counter = await Counter.findOneAndUpdate(
      { name: "worker_id" },
      { $inc: { seq: data.length } },
      { new: true, upsert: true }
    );

    let startId = counter.seq - data.length + 1;

    // const workersWithIds = data.map((worker, index) => ({
    //   ...worker,
    //   id: startId + index,
    // }));
    const workersWithIds = data.map((worker, index) => ({
      ...worker,
      name: toUpper(worker.name),
      employee_id: String(worker.employee_id).trim(),
      fathers_name: toUpper(worker.fathers_name),
      aadhar_no: String(worker.aadhar_no).trim(),
      gender: toUpper(worker.gender),
      phone_no: String(worker.phone_no).trim(),
      designation: toUpper(worker.designation),
      contractor_name: toUpper(worker.contractor_name),
      weight: worker.weight ? Number(worker.weight) : undefined,
      dob: excelDateToJSDate(worker.dob),
      date_of_joining: excelDateToJSDate(worker.date_of_joining),
      id: startId + index
    }));
    await Worker.insertMany(workersWithIds);

    res.json({
      message: "Bulk upload successful",
      count: workersWithIds.length,
    });

    // res.json({ message: "Bulk upload successful", count: data.length });
  } catch (err) {
    res.status(400).json({ message: err.message });
    console.error("Bulk upload error:", err);
  }
});

router.put("/:id", protect, allowRoles("ADMIN"), async (req, res) => {
  try {
    const updated = await Worker.findOneAndUpdate(
      { id: Number(req.params.id) }, // ✅ custom id
      {
        name: toUpper(req.body.name),
        employee_id: String(req.body.employee_id || "").trim(),
        fathers_name: toUpper(req.body.fathers_name),
        aadhar_no: String(req.body.aadhar_no || "").trim(),
        gender: toUpper(req.body.gender),
        dob: req.body.dob ? excelDateToJSDate(req.body.dob) : undefined,
        residence: req.body.residence ? String(req.body.residence): "",
        phone_no: String(req.body.phone_no || "").trim(),
        designation: toUpper(req.body.designation),
        contractor_name: toUpper(req.body.contractor_name),
        date_of_joining: req.body.date_of_joining
          ? excelDateToJSDate(req.body.date_of_joining)
          : undefined,
        identification_marks: req.body.identification_marks
      },
      { new: true }
    );
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete("/:id", protect, allowRoles("ADMIN"), async (req, res) => {
  try {
    await Worker.findByIdAndDelete(req.params.id);
    res.json({ message: "Worker deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});



export default router;


// Excel Format
// name | employee_id | fathers_name | aadhar_no | gender | dob | phone_no | designation | contractor_name | date_of_joining
