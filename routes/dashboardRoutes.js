import express from "express";
import PreEmployment from "../models/PreEmployment.js";
import IdRenewal from "../models/IdRenewal.js";
import OPD from "../models/OPD.js";
import Worker from "../models/Worker.js";

const router = express.Router();

/**
 * Helper to build date range
 */
function buildDateRange({ type, from, to, year, month }) {
  let start, end;

  if (type === "date") {
  start = new Date(from);
  end = new Date(to);
  end.setHours(23, 59, 59, 999);
}


  if (type === "month") {
    start = new Date(year, month - 1, 1);
    end = new Date(year, month, 0, 23, 59, 59);
  }

  if (type === "year") {
    start = new Date(year, 0, 1);
    end = new Date(year, 11, 31, 23, 59, 59);
  }

  return { $gte: start, $lte: end };
}

router.get("/summary", async (req, res) => {
  try {
    const dateFilter = buildDateRange(req.query);

    /* ---------------- PRE EMPLOYMENT ---------------- */
    const preEmploymentStats = await PreEmployment.aggregate([
      { $match: { date_of_examination: dateFilter } },
      {
        $group: {
          _id: null,
          ongoing: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$status", "On-Going"] },
                    {
                      $or: [
                        { $eq: ["$physical_parameters.status", "Not Done"] },
                        { $eq: ["$opthalmic_examination.status", "Not Done"] }
                      ]
                    }
                  ]
                },
                1,
                0
              ]
            }
          },
          fit: {
            $sum: { $cond: [{ $eq: ["$duty_fit", true] }, 1, 0] }
          },
          unfit: {
            $sum: { $cond: [{ $eq: ["$duty_fit", false] }, 1, 0] }
          }
        }
      }
    ]);

    /* ---------------- ID RENEWALS ---------------- */
    const idRenewalsDone = await IdRenewal.countDocuments({
      date_of_renewal: dateFilter
    });

    /* ---------------- OPD ---------------- */
    const opdDone = await OPD.countDocuments({
      created_at: dateFilter
    });

    /* ---------------- WORKERS ---------------- */
    const workers = await Worker.aggregate([
      {
        $group: {
          _id: "$id_status",
          count: { $sum: 1 }
        }
      }
    ]);

    const activeWorkers =
      workers.find(w => w._id === "Active")?.count || 0;
    const expiredWorkers =
      workers.find(w => w._id === "Expired")?.count || 0;

    res.json({
      preEmployment: preEmploymentStats[0] || {
        ongoing: 0,
        fit: 0,
        unfit: 0
      },
      idRenewalsDone,
      opdDone,
      workers: {
        active: activeWorkers,
        expired: expiredWorkers
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Dashboard fetch failed" });
  }
});

router.get("/trends", async (req, res) => {
  const { from, to } = req.query;

  const start = new Date(from);
const end = new Date(to);
end.setHours(23, 59, 59, 999);

const range = {
  $gte: start,
  $lte: end
};


  function groupByDay(field) {
    return {
      year: { $year: `$${field}` },
      month: { $month: `$${field}` },
      day: { $dayOfMonth: `$${field}` }
    };
  }

  const [preEmploymentTrend, idRenewalTrend, opdTrend] = await Promise.all([
    PreEmployment.aggregate([
      { $match: { date_of_examination: range } },
      { $group: { _id: groupByDay("date_of_examination"), count: { $sum: 1 } } },
      { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } }
    ]),
    IdRenewal.aggregate([
      { $match: { date_of_renewal: range } },
      { $group: { _id: groupByDay("date_of_renewal"), count: { $sum: 1 } } }
    ]),
    OPD.aggregate([
      { $match: { created_at: range } },
      { $group: { _id: groupByDay("created_at"), count: { $sum: 1 } } }
    ])
  ]);

  res.json({ preEmploymentTrend, idRenewalTrend, opdTrend });
});



router.get("/list/:type", async (req, res) => {
  const { type } = req.params;
  const { from, to } = req.query;

  const range = {
    $gte: new Date(from),
    $lte: new Date(to)
  };

  let data = [];

  if (type === "preemployment") {
    data = await PreEmployment.find({ date_of_examination: range });
  }
  if (type === "idrenewal") {
    data = await IdRenewal.find({ date_of_renewal: range });
  }
  if (type === "opd") {
    data = await OPD.find({ created_at: range });
  }

  res.json(data);
});


export default router;
