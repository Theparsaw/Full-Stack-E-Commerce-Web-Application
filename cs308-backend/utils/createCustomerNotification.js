const mongoose = require("mongoose");
const Notification = require("../models/Notification");
const { publishNotification } = require("./notificationEvents");

const createCustomerNotification = async ({
  userId,
  type,
  title,
  message,
  referenceId,
  productId = "",
  productName = "",
}) => {
  if (mongoose.connection.readyState !== 1) {
    return null;
  }

  try {
    const notification = await Notification.findOneAndUpdate(
      {
        userId: String(userId),
        type,
        referenceId: String(referenceId),
      },
      {
        userId: String(userId),
        type,
        title,
        message,
        referenceId: String(referenceId),
        productId: String(productId || ""),
        productName: String(productName || ""),
        campaignId: `${type}:${referenceId}`,
        discountPercentage: 0,
        isRead: false,
      },
      {
        upsert: true,
        returnDocument: "after",
        setDefaultsOnInsert: true,
      }
    );

    publishNotification(notification);
    return notification;
  } catch (error) {
    console.error("Customer notification failed:", error);
    return null;
  }
};

module.exports = { createCustomerNotification };
