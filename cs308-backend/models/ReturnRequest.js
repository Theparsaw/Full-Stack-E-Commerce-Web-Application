const mongoose = require("mongoose");

const returnedItemSchema = new mongoose.Schema(
  {
    productId: {
      type: String,
      required: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
  },
  {
    _id: false,
  }
);

const returnRequestSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      ref: "User",
      required: true,
      trim: true,
      index: true,
    },
    orderId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    items: {
      type: [returnedItemSchema],
      required: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
    photoUrls: {
      type: [String],
      default: [],
      validate: {
        validator: (urls) => Array.isArray(urls) && urls.length <= 5,
        message: "A return request can include at most 5 photos",
      },
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

returnRequestSchema.index({ userId: 1, orderId: 1 });

module.exports = mongoose.model("ReturnRequest", returnRequestSchema);
