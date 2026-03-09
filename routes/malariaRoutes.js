import express from "express";
import Malaria from "../models/Malaria.js";
import Worker from "../models/Worker.js";

const router = express.Router();

router.get("/workers/all", async (req, res) => {
    try {
        const workers = await Worker.find();
        res.json(workers);
    }catch (err){
        res.status(500).json({message: err.message});
    }
})

router.post("/create", async (req, res) => {
  try {
    const { worker_id, date_of_test, tested_by } = req.body;

    const malaria = new Malaria({
      worker_id,
      date_of_test,
      tested_by
    });

    await malaria.save();

    res.json(malaria);

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
});

router.get("/worker/:id", async (req, res) => {
    try {
        const worker_id = req.params.id;
        const tests_list = await Malaria.find({ worker_id });
        res.json(tests_list);
    }catch(err){
        console.error(err);
        res.status(500).json({ message: err.message });
    }
});

export default router;