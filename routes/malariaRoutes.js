import express from "express";
import Malaria from "../models/Malaria.js";
import Worker from "../models/Worker.js";
import PreEmployment from "../models/PreEmployment.js";

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
        // console.log(tests_list);
        const worker = await Worker.findOne({id: worker_id}, {preemployment_id: 1});
        const preemp = await PreEmployment.findOne({id: worker.preemployment_id}, {date_of_examination: 1});
        console.log({tests_list, preemp});
        res.json({tests_list, preemp});
    }catch(err){
        console.error(err);
        res.status(500).json({ message: err.message });
    }
});

export default router;