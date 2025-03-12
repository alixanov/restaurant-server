// model/tableModel.js
const mongoose = require("mongoose");

const tableSchema = new mongoose.Schema(
  {
    number: { type: Number, required: true, unique: true },
    isActive: { type: Boolean, default: false }, // Hisob yopilganda false bo'ladi
    capacity: { type: Number, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Table", tableSchema);
