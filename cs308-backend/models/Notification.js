const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },

    type: {
      type: String,
      enum: ["discount", "refund_approved", "refund_rejected", "review_approved", "review_rejected"],
      default: "discount",
      index: true,
    },

    title: {
      type: String,
      trim: true,
      default: "",
    },

    referenceId: {
      type: String,
      trim: true,
      default: "",
    },

    productId: {
      type: String,
      trim: true,
      default: "",
    },

    campaignId: {
      type: String,
      trim: true,
      default: "",
    },

    productName: {
      type: String,
      trim: true,
      default: "",
    },

    discountPercentage: {
      type: Number,
      min: 0,
      default: 0,
    },

    message: {
      type: String,
      required: true,
      trim: true,
    },

    isRead: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

notificationSchema.index(
  {
    userId: 1,
    productId: 1,
    campaignId: 1,
  },
  {
    unique: true,
  }
);

module.exports = mongoose.model("Notification", notificationSchema);
