const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 120 },
  category: { type: String, required: true, trim: true },
  description: { type: String, required: true, maxlength: 1200 },
  date: { type: Date, required: true },
  time: { type: String, required: true },
  venue: { type: String, required: true, trim: true },
  city: { type: String, required: true, trim: true },
  price: { type: Number, required: true, min: 0 },
  capacity: { type: Number, required: true, min: 1 },
  bookedSeats: { type: Number, default: 0, min: 0 },
  image: { type: String, default: "" },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
}, { timestamps: true });

eventSchema.virtual("availableSeats").get(function () {
  return Math.max(0, this.capacity - this.bookedSeats);
});

module.exports = mongoose.model("Event", eventSchema);
