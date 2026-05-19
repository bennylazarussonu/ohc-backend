import mongoose from "mongoose";
import Counter from "./Counter.js";

const zoneVisitSchema =
    new mongoose.Schema({

        id: {
            type: Number,
            unique: true
        },

        visit_id: {
            type: Number
        },

        is_closed: {
    type: Boolean,
    default: false
},

        zone_id: {
            type: Number,
            required: true
        },

        visit_date: {
            type: Date,
            default: Date.now
        },

        remarks: {
            type: String
        },

        visited_by: {
            type: String
        }

    });

zoneVisitSchema.pre(
    "save",
    async function () {

        if (this.id) return;

        const counter =
            await Counter.findOneAndUpdate(

                {
                    name:
                        "zone_visit_id"
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
    "ZoneVisit",
    zoneVisitSchema
);