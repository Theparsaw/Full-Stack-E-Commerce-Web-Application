const express = require("express");
// 👉 We need to make sure ALL of these are imported from the controller!
const {
  createReturnRequest,
  getMyReturnRequests,
  getPendingReturnRequests,
  approveReturnRequest,
  rejectReturnRequest,
  getReturnHistory, // 👈 THIS IS THE MISSING PIECE!
} = require("../controllers/returnRequestController");

const { authMiddleware, authorize } = require("../middleware/authMiddleware");
const { uploadReturnPhotos } = require("../middleware/uploadMiddleware");

const router = express.Router();

router.use(authMiddleware); // All routes require login

// ==========================================
// Customer Routes
// ==========================================
router.get("/my-returns", authorize("customer"), getMyReturnRequests);
router.get("/", authorize("customer"), getMyReturnRequests);
router.post("/", authorize("customer"), uploadReturnPhotos.array("photos", 5), createReturnRequest);

// ==========================================
// Sales Manager Admin Routes
// ==========================================
router.get("/pending", authorize("sales_manager"), getPendingReturnRequests);
router.get("/history", authorize("sales_manager"), getReturnHistory);
router.patch("/:id/approve", authorize("sales_manager"), approveReturnRequest);
router.patch("/:id/reject", authorize("sales_manager"), rejectReturnRequest);

module.exports = router;
