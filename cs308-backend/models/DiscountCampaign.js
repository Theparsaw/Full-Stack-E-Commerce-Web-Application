const mongoose = require("mongoose");
const AppError = require("../utils/appError");

const discountCampaignSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    productIds: {
      type: [String],
      required: true,
      validate: {
        validator: (arr) => arr.length > 0,
        message: "At least one product must be selected",
      },
    },
    discountPercentage: {
      type: Number,
      required: true,
      min: 1,
      max: 100,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// End date must be after start date
discountCampaignSchema.pre("save", function () {
  if (this.endDate <= this.startDate) {
    throw new AppError("End date must be after start date", 400, "VALIDATION_ERROR");
  }
});

module.exports = mongoose.model("DiscountCampaign", discountCampaignSchema);