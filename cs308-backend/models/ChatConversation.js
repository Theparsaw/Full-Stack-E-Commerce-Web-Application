const mongoose = require("mongoose");

const chatConversationSchema = new mongoose.Schema(
  {
    customerId: {
      type: String,
      required: true,
    },
    agentId: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ["unclaimed", "active", "closed"],
      default: "unclaimed",
    },
    subject: {
      type: String,
      default: "Support Request",
      trim: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ChatConversation", chatConversationSchema);
