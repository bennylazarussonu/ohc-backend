import mongoose from "mongoose";
import Counter from "./Counter";

const IdRenewalSchema = new mongoose.Schema({
    id: {type: Number, unique: true},
})