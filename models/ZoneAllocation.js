import mongoose from "mongoose";
import Counter from "./Counter.js";

const zoneAllocationSchema =
    new mongoose.Schema({

        id: {
            type: Number,
            unique: true
        },

        visit_id: {
            type: Number
        },

        zone_id: {
            type: Number
        },

        medicine_id: {
            type: Number
        },

        stock_id: {
            type: Number
        },

        item_name: String,

        brand: String,

        quantity: Number,

        expiry_date: Date,

        per_unit_cost: Number,

        allocated_at: {
            type: Date,
            default: Date.now
        },

        allocated_by: String

    });

zoneAllocationSchema.pre(
    "save",
    async function () {

        if (this.id) return;

        const counter =
            await Counter.findOneAndUpdate(

                {
                    name:
                        "zone_allocation_id"
                },

                {
                    $inc: {
                        seq: 1
                    }
                },

                {
                    new: true,
                    upsert: true
                }
            );

        this.id = counter.seq;
    }
);

export default mongoose.model(
    "ZoneAllocation",
    zoneAllocationSchema
);