import XLSX from "xlsx";
import mongoose from "mongoose";

import Zone from "../models/Zone.js";
import Medicines from "../models/Medicines.js";
import FABInventoryBatch from "../models/FABInventoryBatch.js";
import FABTemplateItem from "../models/FABTemplateItem.js";
import dotenv from "dotenv";

const excelPath = process.argv[2];

if (!excelPath) {
    console.error("Please provide the Excel file path.");
    process.exit(1);
}

dotenv.config();

await mongoose.connect(process.env.MONGODB_URI);

console.log("Connected to MongoDB");

const workbook = XLSX.readFile(excelPath);

console.log(`Found ${workbook.SheetNames.length} sheets.`);
console.log(workbook.SheetNames);

const fabSheets = [
    "Copy of Z1",
    "Z2",
    "BSZ1",
    "BSZ3",
    "TCAP",
    "CRE_TCAP",
    "AMBU",
    "CHEMBURGH",
    "MAHUL_LC",
    "ADMIN_BLK",
    "THANEHC",
    "HYDRA_Z3",
    "VEHICLEFABZ1",
    "KALINALC",
    "LIFTZ2",
    "CRANE",
    "XMG EXCAVATOR",
    "Copy of ELEC BUS",
];

function parseExpiryDate(value) {
    if (
        value === null ||
        value === undefined ||
        String(value).trim() === "" ||
        String(value).trim() === "--"
    ) {
        return null;
    }

    // Excel serial date
    if (typeof value === "number") {
        const parsed = XLSX.SSF.parse_date_code(value);

        if (!parsed) {
            return null;
        }

        return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d));
    }

    // Date string
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return null;
    }

    return date;
}

console.log("\n========== EXPIRY DATE TEST ==========");

for (const value of [46784, 46692, "", "--", null]) {
    console.log({
        input: value,
        output: parseExpiryDate(value),
    });
}

console.log(`FAB sheets selected: ${fabSheets.length}`);
console.log(fabSheets);

// for (const sheetName of fabSheets) {
//     const sheet = workbook.Sheets[sheetName];

//     const rows = XLSX.utils.sheet_to_json(sheet, {
//         header: 1,
//         defval: null
//     });

//     const headerRowIndex = rows.findIndex(row =>
//         row.some(cell =>
//             String(cell ?? "").trim().toUpperCase() === "ITEM"
//         )
//     );

//     if (headerRowIndex === -1) {
//         console.log(`❌ ${sheetName}: ITEM header not found`);
//         continue;
//     }

//     const header = rows[headerRowIndex].map(cell =>
//         String(cell ?? "").trim().toUpperCase()
//     );

//     const columns = {
//         item: header.indexOf("ITEM"),
//         category: header.indexOf("CATEGORY"),
//         expiry: header.indexOf("EXPIRY DATE"),
//         unit: header.indexOf("UNIT"),
//         qty: header.indexOf("QTY")
//     };

//     console.log(`\n========== ${sheetName} ==========`);

//     const inventoryRows = rows
//         .slice(headerRowIndex + 1)
//         .filter(row => {
//             const item = row[columns.item];
//             return item !== null && String(item).trim() !== "";
//         });

//     console.log(`Inventory rows found: ${inventoryRows.length}`);

//     inventoryRows.slice(0, 5).forEach((row, index) => {
//         console.log({
//             row: index + 1,
//             item: row[columns.item],
//             category: row[columns.category],
//             expiry: row[columns.expiry],
//             unit: row[columns.unit],
//             qty: row[columns.qty]
//         });
//     });
// }

// const unmatchedItems = new Map();

// for (const sheetName of fabSheets) {
//     const sheet = workbook.Sheets[sheetName];

//     const rows = XLSX.utils.sheet_to_json(sheet, {
//         header: 1,
//         defval: null
//     });

//     const headerRowIndex = rows.findIndex(row =>
//         row.some(cell =>
//             String(cell ?? "").trim().toUpperCase() === "ITEM"
//         )
//     );

//     if (headerRowIndex === -1) {
//         continue;
//     }

//     const header = rows[headerRowIndex].map(cell =>
//         String(cell ?? "").trim().toUpperCase()
//     );

//     const columns = {
//         item: header.indexOf("ITEM"),
//         category: header.indexOf("CATEGORY")
//     };

//     const inventoryRows = rows
//         .slice(headerRowIndex + 1)
//         .filter(row => {
//             const item = row[columns.item];

//             return (
//                 item !== null &&
//                 String(item).trim() !== ""
//             );
//         });

//     for (const row of inventoryRows) {
//         const itemName = String(row[columns.item]).trim();

//         const medicine = await Medicines.findOne({
//             drug_name_and_dose: itemName
//         });

//         if (!medicine) {
//             const category =
//                 row[columns.category] !== null &&
//                 String(row[columns.category]).trim() !== ""
//                     ? String(row[columns.category]).trim()
//                     : "";

//             unmatchedItems.set(itemName, category);
//         }
//     }
// }

// console.log("\n========== UNIQUE UNMATCHED ITEMS ==========");

// for (const [item, category] of unmatchedItems) {
//     console.log({
//         item,
//         category
//     });
// }

// console.log(
//     `\nTotal unique unmatched items: ${unmatchedItems.size}`
// );

// const medicinesToCreate = [
//     {
//         drug_name_and_dose:
//             "T-PWD.NEOMYCIN_(N-BAXIN)_NEOMYCINSULPHATE_SULPHACETAMIDESODIUM_BACITRACIN_(10GM)",
//         category: "POWDER"
//     },
//     {
//         drug_name_and_dose: "DISPOSABLE_SYRINGE_2CC",
//         category: "SYRINGE"
//     },
//     {
//         drug_name_and_dose: "GEL.2%XYLOCAINE",
//         category: "GEL"
//     },
//     {
//         drug_name_and_dose:
//             "TAB.PHENYLEPHRINE_HCL_PARACETAMOL_CETRIZINE",
//         category: ""
//     },
//     {
//         drug_name_and_dose: "TAB.VITAMIN_B_COMPLEX",
//         category: ""
//     }
// ];

// console.log("\n========== CREATING MISSING MEDICINES ==========");

// for (const medicineData of medicinesToCreate) {
//     const existingMedicine = await Medicines.findOne({
//         drug_name_and_dose: medicineData.drug_name_and_dose
//     });

//     if (existingMedicine) {
//         console.log(
//             `⚠️ Already exists: ${medicineData.drug_name_and_dose} → ID ${existingMedicine.id}`
//         );
//         continue;
//     }

//     const medicine = await Medicines.create(medicineData);

//     console.log(
//         `✅ Created: ${medicine.drug_name_and_dose} → ID ${medicine.id}`
//     );
// }

// console.log("\nMedicine creation completed.");

// console.log("\n========== INVENTORY IMPORT PREVIEW ==========");

// for (const sheetName of fabSheets) {
//     const zone = await Zone.findOne({
//         zone_name: sheetName
//     });

//     if (!zone) {
//         console.log(`❌ ${sheetName} → ZONE NOT FOUND`);
//         continue;
//     }

//     const sheet = workbook.Sheets[sheetName];

//     const rows = XLSX.utils.sheet_to_json(sheet, {
//         header: 1,
//         defval: null
//     });

//     const headerRowIndex = rows.findIndex(row =>
//         row.some(cell =>
//             String(cell ?? "").trim().toUpperCase() === "ITEM"
//         )
//     );

//     if (headerRowIndex === -1) {
//         console.log(`❌ ${sheetName} → ITEM HEADER NOT FOUND`);
//         continue;
//     }

//     const header = rows[headerRowIndex].map(cell =>
//         String(cell ?? "").trim().toUpperCase()
//     );

//     const columns = {
//         item: header.indexOf("ITEM"),
//         expiry: header.indexOf("EXPIRY DATE"),
//         qty: header.indexOf("QTY")
//     };

//     const inventoryRows = rows
//         .slice(headerRowIndex + 1)
//         .filter(row => {
//             const item = row[columns.item];

//             return (
//                 item !== null &&
//                 String(item).trim() !== "" &&
//                 !String(item).trim().toUpperCase().startsWith("NOTE:")
//             );
//         });

//     console.log(`\n========== ${sheetName} ==========`);
//     console.log(`Zone ID: ${zone.id}`);
//     console.log(`Inventory rows: ${inventoryRows.length}`);

//     inventoryRows.forEach((row, index) => {
//         console.log({
//             row: index + 1,
//             item: String(row[columns.item]).trim(),
//             expiry: row[columns.expiry],
//             quantity: row[columns.qty]
//         });
//     });
// }

console.log("\n========== PRE-IMPORT VALIDATION ==========");

let totalRows = 0;
let validRows = 0;
const errors = [];
const missingItems = new Map();

for (const sheetName of fabSheets) {
    const zone = await Zone.findOne({ zone_name: sheetName });

    if (!zone) {
        errors.push(`${sheetName}: zone not found`);
        continue;
    }

    const sheet = workbook.Sheets[sheetName];

    const rows = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: null,
    });

    const headerRowIndex = rows.findIndex((row) =>
        row.some(
            (cell) =>
                String(cell ?? "")
                    .trim()
                    .toUpperCase() === "ITEM",
        ),
    );

    if (headerRowIndex === -1) {
        errors.push(`${sheetName}: ITEM header not found`);
        continue;
    }

    const header = rows[headerRowIndex].map((cell) =>
        String(cell ?? "")
            .trim()
            .toUpperCase(),
    );

    const columns = {
        item: header.indexOf("ITEM"),
        category: header.indexOf("CATEGORY"),
        qty: header.indexOf("QTY"),
        expiry: header.indexOf("EXPIRY DATE"),
        remarks: header.indexOf("REMARKS"),
    };

    if (columns.qty === -1 || columns.expiry === -1) {
        errors.push(`${sheetName}: required columns missing`);
        continue;
    }

    const inventoryRows = rows.slice(headerRowIndex + 1);

    for (const row of inventoryRows) {
        const rawItem = row[columns.item];

        const remarks = String(row[columns.remarks] ?? "")
            .trim()
            .toUpperCase();

        if (remarks === "N.A.") {
            continue;
        }

        if (
            rawItem === null ||
            String(rawItem).trim() === "" ||
            String(rawItem).trim().toUpperCase().startsWith("NOTE:")
        ) {
            continue;
        }

        totalRows++;

        const itemName = String(rawItem).trim();
        const quantity = Number(row[columns.qty]);
        const expiry = parseExpiryDate(row[columns.expiry]);

        const medicine = await Medicines.findOne({
            drug_name_and_dose: itemName,
        });

        if (!medicine) {
            const category = String(row[columns.category] ?? "").trim();

            if (!missingItems.has(itemName)) {
                missingItems.set(itemName, category);
            }

            errors.push(`${sheetName}: medicine not found: ${itemName}`);
            continue;
        }

        if (
            row[columns.qty] === null ||
            row[columns.qty] === "" ||
            !Number.isFinite(quantity) ||
            quantity < 0
        ) {
            errors.push(`${sheetName}: invalid quantity for ${itemName}`);
            continue;
        }

        if (
            row[columns.expiry] !== null &&
            String(row[columns.expiry]).trim() !== "" &&
            String(row[columns.expiry]).trim() !== "--" &&
            expiry === null
        ) {
            errors.push(`${sheetName}: invalid expiry for ${itemName}`);
            continue;
        }

        validRows++;
    }

    console.log(`Checked ${sheetName}`);
}

console.log("\n========== UNIQUE MISSING ITEMS ==========");

for (const [item, category] of missingItems) {
    console.log({ item, category });
}

console.log("Unique missing items:", missingItems.size);

console.log("\n========== VALIDATION SUMMARY ==========");
console.log(`Rows found: ${totalRows}`);
console.log(`Valid rows: ${validRows}`);
console.log(`Errors: ${errors.length}`);

errors.forEach((error) => console.log(`❌ ${error}`));

if (errors.length > 0) {
    console.log("\nImport must not proceed until errors are resolved.");
} else {
    console.log("\nAll rows passed validation. No data was written.");
}

console.log("\n========== PRODUCTION ZONE CHECK ==========");

const allZones = await Zone.find(
    {},
    {
        id: 1,
        zone_name: 1,
    },
)
    .sort({ zone_name: 1 })
    .lean();

console.log("Zones found in production:", allZones.length);

for (const zone of allZones) {
    console.log({
        id: zone.id,
        zone_name: zone.zone_name,
    });
}


console.log("\n========== EXISTING FAB RECORD CHECK ==========");

const templateCount = await FABTemplateItem.countDocuments({
    zone_id: { $in: [5, 6, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 23, 24] }
});

const batchCount = await FABInventoryBatch.countDocuments({
    zone_id: { $in: [5, 6, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 23, 24] },
    source_type: "OPENING",
    source_id: null
});

console.log("Existing FAB template records:", templateCount);
console.log("Existing opening inventory batches:", batchCount);

console.log("\nPREVIEW ONLY — no database writes performed.");

console.log("\n========== DUPLICATE ITEM CHECK ==========");

const duplicateItems = new Map();

for (const sheetName of fabSheets) {
    const sheet = workbook.Sheets[sheetName];

    const rows = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: null
    });

    const headerRowIndex = rows.findIndex(row =>
        row.some(cell =>
            String(cell ?? "").trim().toUpperCase() === "ITEM"
        )
    );

    if (headerRowIndex === -1) continue;

    const header = rows[headerRowIndex].map(cell =>
        String(cell ?? "").trim().toUpperCase()
    );

    const itemCol = header.indexOf("ITEM");
    const remarksCol = header.indexOf("REMARKS");

    const counts = new Map();

    for (const row of rows.slice(headerRowIndex + 1)) {
        const item = String(row[itemCol] ?? "").trim();
        const remarks = String(row[remarksCol] ?? "")
            .trim()
            .toUpperCase();

        if (
            !item ||
            item.toUpperCase().startsWith("NOTE:") ||
            remarks === "N.A."
        ) {
            continue;
        }

        counts.set(item, (counts.get(item) || 0) + 1);
    }

    for (const [item, count] of counts) {
        if (count > 1) {
            duplicateItems.set(`${sheetName} :: ${item}`, count);
        }
    }
}

if (duplicateItems.size === 0) {
    console.log("No duplicate item names found within selected zones.");
} else {
    for (const [key, count] of duplicateItems) {
        console.log(`${key} — ${count} occurrences`);
    }
    console.log("Duplicate groups:", duplicateItems.size);
}