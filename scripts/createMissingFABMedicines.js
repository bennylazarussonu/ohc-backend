
import mongoose from "mongoose";
import dotenv from "dotenv";
import Medicines from "../models/Medicines.js";

dotenv.config();

const missingItems = [
    {
        drug_name_and_dose: "STERILE_GAUZE_PAD_MEDIUM_(7.5CM X 7.5CM)",
        category: "DRESSING_PAD",
    },
    {
        drug_name_and_dose: "COTTON_ROLL_PACK_20GM",
        category: "COTTON",
    },
    {
        drug_name_and_dose: "LOT.CETRIMIDE_100ML",
        category: "DISINFECTANT",
    },
    {
        drug_name_and_dose: "T-SOL.POVIDONE_IODINE_10%W/V (100ML)",
        category: "DISINFECTANT",
    },
    {
        drug_name_and_dose: "TWEEZERS",
        category: "GADGET",
    },
    {
        drug_name_and_dose: "DISPOSABLE_GLOVES_1PAIR_FR_FIRST-AID",
        category: "DISPOSABLE",
    },
    {
        drug_name_and_dose: "TAB.GELUCIL_MPS/ DIGENE_ANTACID (CHEWABLE TABS)",
        category: "ANTACID",
    },
    {
        drug_name_and_dose: "MICROPORE_ADHESIVE_PLASTER_0.5INCH",
        category: "",
    },
    {
        drug_name_and_dose: "GAUZE_BANDAGE_ROLL_7.5CM",
        category: "",
    },
    {
        drug_name_and_dose: "DISPOSABLE_SYRINGE_2CC",
        category: "SYRINGE",
    },
    {
        drug_name_and_dose: "GEL.2%XYLOCAINE",
        category: "GEL",
    },
    {
        drug_name_and_dose: "TAB.PHENYLEPHRINE_HCL_PARACETAMOL_CETRIZINE",
        category: "",
    },
    {
        drug_name_and_dose: "TAB.VITAMIN_B_COMPLEX",
        category: "",
    },
];

try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    console.log("DRY RUN: no records will be created.");

    for (const item of missingItems) {
        const existing = await Medicines.findOne({
            drug_name_and_dose: item.drug_name_and_dose,
        }).lean();

        if (existing) {
            console.log(
                `EXISTS: ${item.drug_name_and_dose} (ID ${existing.id})`
            );
        } else {
            console.log("WOULD CREATE:", item);
        }
    }
} catch (error) {
    console.error("Check failed:", error);
    process.exitCode = 1;
} finally {
    await mongoose.disconnect();
}
