const mongoose = require("mongoose");
const { encryptValue, decryptValue } = require("../utils/encryption");

const invoiceSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      required: true,
      unique: true,
    },
    userId: {
      type: String,
      required: true,
    },
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
      set: encryptValue,
      get: decryptValue,
    },
    amount: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ["generated", "emailed", "failed"],
      default: "generated",
    },
  },
  {
    timestamps: true,
    toJSON: { getters: true },
    toObject: { getters: true },
  }
);

module.exports = mongoose.model("Invoice", invoiceSchema);