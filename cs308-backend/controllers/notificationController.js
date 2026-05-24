const Notification = require("../models/Notification");
const User = require("../models/User");
const AppError = require("../utils/appError");
const asyncHandler = require("../utils/asyncHandler");
const jwt = require("jsonwebtoken");
const { getJwtSecret } = require("../utils/jwt");
const { addNotificationClient } = require("../utils/notificationEvents");

const getMyNotifications = asyncHandler(async (req, res) => {

  const notifications = await Notification.find({
    userId: String(req.user.id),
  }).sort({ createdAt: -1 });

  return res.status(200).json({
    notifications,

    unreadCount:
      notifications.filter(
        (notification) => !notification.isRead
      ).length,
  });
});

const markNotificationAsRead = asyncHandler(async (req, res) => {

  const notification = await Notification.findById(
    req.params.id
  );

  if (!notification) {
    throw new AppError(
      "Notification not found",
      404,
      "NOTIFICATION_NOT_FOUND"
    );
  }

  if (
    String(notification.userId) !==
    String(req.user.id)
  ) {
    throw new AppError(
      "Access denied",
      403,
      "FORBIDDEN"
    );
  }

  notification.isRead = true;

  await notification.save();

  return res.status(200).json({
    message: "Notification marked as read",
    notification,
  });
});

const streamMyNotifications = asyncHandler(async (req, res) => {
  const authHeader = req.headers.authorization || "";
  const bearerToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;
  const token = bearerToken || req.query.token;

  if (!token) {
    throw new AppError("Authentication token is required", 401, "AUTH_REQUIRED");
  }

  let decoded;

  try {
    decoded = jwt.verify(token, getJwtSecret());
  } catch (error) {
    throw new AppError("Invalid token", 401, "INVALID_TOKEN");
  }

  const user = await User.findById(decoded.id).select("_id role");

  if (!user) {
    throw new AppError("User no longer exists", 401, "USER_NOT_FOUND");
  }

  if (user.role !== "customer") {
    throw new AppError("You are not allowed to access this resource", 403, "FORBIDDEN");
  }

  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders?.();

  const cleanup = addNotificationClient(String(user._id), res);
  const keepAliveId = setInterval(() => {
    res.write(": keep-alive\n\n");
  }, 25000);

  req.on("close", () => {
    clearInterval(keepAliveId);
    cleanup();
  });
});

module.exports = {
  getMyNotifications,
  markNotificationAsRead,
  streamMyNotifications,
};
