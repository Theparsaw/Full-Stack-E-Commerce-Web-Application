const mongoose = require("mongoose");

const returnItemSchema = new mongoose.Schema(
  {
    productId: {
      type: String,
      required: true,
    },

    name: {
      type: String,
      required: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
    },

    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

const returnRequestSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      required: true,
    },

    userId: {
      type: String,
      ref: "User",
      required: true,
    },

    items: {
      type: [returnItemSchema],
      required: true,
      default: [],
    },

    reason: {
      type: String,
      required: true,
      trim: true,
    },

    refundAmount: {
      type: Number,
      required: true,
      min: 0,
    },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },

    managerNotes: {
      type: String,
      trim: true,
      default: "",
    },

    rejectionReason: {
      type: String,
      trim: true,
      default: "",
    },

    reviewedBy: {
      type: String,
      ref: "User",
      trim: true,
      default: null,
    },

    resolvedAt: {
      type: Date,
      default: null,
    },

    resolutionDate: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports =
  mongoose.model(
    "ReturnRequest",
    returnRequestSchema
  );
