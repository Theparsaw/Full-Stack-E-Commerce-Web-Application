const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema(
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
    costPrice: {
      type: Number,
      min: 0,
      default: null,
    },
    originalPrice: {
      type: Number,
      min: 0,
      default: null,
    },
    discountPercentage: {
      type: Number,
      min: 0,
      default: 0,
    },
    campaignName: {
      type: String,
      trim: true,
      default: "",
    },
    hasDiscount: {
      type: Boolean,
      default: false,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    returnedQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: ["active", "returned"],
      default: "active",
    },
  },
  {
    _id: false,
  }
);

const orderSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      trim: true,
    },
    cartId: {
      type: String,
      required: true,
      trim: true,
    },
    items: {
      type: [orderItemSchema],
      required: true,
      default: [],
    },
    totalPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ["pending_payment", "paid", "payment_failed", "cancelled"],
      default: "pending_payment",
    },
    paidAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Order", orderSchema);
