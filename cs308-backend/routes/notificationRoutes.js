const express = require("express");

const {
  getMyNotifications,
  markNotificationAsRead,
  streamMyNotifications,
} = require("../controllers/notificationController");

const {
  authMiddleware,
} = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/stream", streamMyNotifications);

router.use(authMiddleware);

router.get("/", getMyNotifications);

router.patch("/:id/read", markNotificationAsRead);

module.exports = router;
