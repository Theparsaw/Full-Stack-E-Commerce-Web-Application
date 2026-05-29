const mongoose = require("mongoose");
const { encryptValue, decryptValue } = require("../utils/encryption");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
    },
    taxId: {
      type: String,
      trim: true,
      default: "",
      set: encryptValue,
      get: decryptValue,
    },
    address: {
      type: String,
      trim: true,
      default: "",
      set: encryptValue,
      get: decryptValue,
    },
    // Stores the user's profile photo as a string value that the frontend can render
    profileImage: {
      type: String,
      default: "",
    },
    role: {
      type: String,
      enum: ["customer", "sales_manager", "product_manager", "support_agent"],
      default: "customer",
    },
  },
  {
    timestamps: true,
    toJSON: { getters: true },
    toObject: { getters: true },
  }
);

module.exports = mongoose.model("User", userSchema);
