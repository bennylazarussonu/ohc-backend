import mongoose, { mongo } from "mongoose";
import Counter from "./Counter.js";

const preEmploymentSchema = new mongoose.Schema({
    id: {type: Number, unique: true},
    name: { type: String, uppercase: true, required: true },
    employee_id: { type: String},
    fathers_name: { type: String, uppercase: true },
    aadhar_no: { type: String},
    gender: {type: String, uppercase: true, default: "MALE"},
    dob: { type: Date },
    residence: { type: String },
    phone_no: { type: String },
    designation: { type: String, uppercase: true },
    contractor_name: { type: String, uppercase: true },
    date_of_joining: { type: Date},
    identification_marks: { type: [String] },
    date_of_examination: { type: Date, default: Date.now, required: true },
    status: { type: String, enum: ["On-Going", "Declared Fit", "Declared Unfit", "Cancelled"]},
    presentation: { type: String, default: "Individual presented for health-check at the workplace (First Aid Unit, BKC, Mumbai - 400051) with no significant complaint/s or past illnesses like, epilepsy, mental depression, height phobia, headache,  vertigo,  insomnia, anxiety or drug allergy."},
    physical_examination: { type: String, default: "Examination of the head eyes, ears, nose and throat revealed no abnormality, as follows.  The pupils were of equal size with no squint or nystagmus and reacting simultaneously to light and accomodation. The external ears were normal, with no otorrhoea. Nose had no inflammed turbinales, polyp or septal deviation.The gums (gingival lining) were normal with proper teeth contour devoid of dentures. No congestion or tonsillitis in throat with no significant lymphadenopathy on the neck."},
    general_examination: {type: String, default: "Individual with normal physical appearance, stature & gait. Noted to be adequately hydrated with no fever, pallor, oedema, cyanosis, clubbing, icterus, raised venous pulse or any visible skin lesion. No sign of any communicable/ contagious disease noted."},
    physical_parameters: {
        status: { type: String, enum: ["Done", "Not Done"], default: "Not Done"},
        temperature: { type: Number },
        weight: { type: Number },
        height: { type: Number },
        bmi: { type: Number },
        pulse: { type: Number },
        blood_pressure: {
            systolic: { type: Number },
            diastolic: { type: Number }
        },
        respiratory_rate: { type: Number },
        spo2: { type: Number },
        chest_circumference: {
            inspiration: { type: Number },
            expiration: { type: Number },
            expansion: { type: Number }
        },
        body_surface_area: { type: Number }
    },
    systemic_examination: {
  central_nervous_system: {
    type: String,
    default:
      "Conscious, well oriented, coherent with normal speech, emotion, intelligence, and memory. No cranial nerve defect or dysfunction noted."
  },
  cardiovascular_system: {
    type: String,
    default:
      "Left sided heart with normal, regular, rhythmic heart sounds."
  },
  respiratory_system: {
    type: String,
    default:
      "Normal chest contour with bilateral equal expansion. Auscultation revealed normal vesicular breath sounds bilaterally, suggestive of good air entry (clear lungs) with no respiratory illness."
  },
  gastrointestinal_system: {
    type: String,
    default:
      "No tenderness or palpable masses suggestive of nil organomegaly."
  },
  genitourinary_system: {
    type: String,
    default:
      "Normal genitalia with no hernias or notable tumors."
  },
  musculoskeletal_system: {
    type: String,
    default:
      "Normal gait and stable stature with no deformity or disability."
  }
},
    opthalmic_examination: {
        status: { type: String, enum: ["Done", "Not Done"], default: "Not Done"},
        far_vision: {
            without_glasses: {
                left: { type: String },
                right: { type: String }
            },
            with_glasses: {
                left: { type: String },
                right: { type: String }
            }
        },
        near_vision: {
            without_glasses: {
                left: { type: Number },
                right: { type: Number }
            },
            with_glasses: {
                left: { type: Number },
                right: { type: Number }
            }
        },
        with_glasses_diagnosis: { type: String },
        without_glasses_diagnosis: { type: String },
        color_perception: { type: String }
    },
    clinical_impression: { type: String, default: "PHYSICALLY AND MENTALLY DECLARED FIT FOR JOB PLACEMENT/ CONTINUATION OF WORK" },
    final_recommendation: { type: String, default: "FIT FOR DUTY FOR EMPLOYMENT" },
    physical_fitness: { type: String },
    reason_for_certificate_refusal: { type: String, default: "N/A" },
    reason_for_certificate_revoke: {type: String, default: "N/A"},
    medical_examiner_id: { type: Number },
    duty_fit: { type: Boolean}
});

preEmploymentSchema.pre("save", async function () {
    if(this.id) return ;

    const counter = await Counter.findOneAndUpdate(
    { name: "preemp_id" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  this.id = counter.seq;
});

export default mongoose.model("PreEmployment", preEmploymentSchema);