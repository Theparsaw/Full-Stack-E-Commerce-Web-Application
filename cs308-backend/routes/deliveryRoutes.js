const express = require("express");
const router = express.Router();

const {
  getAllDeliveries,
  updateDeliveryStatus,
  updateOrderDate,
  downloadDeliveryInvoice,
} = require("../controllers/deliveryController");

const { authMiddleware, authorize } = require("../middleware/authMiddleware");

router.use(authMiddleware, authorize("product_manager"));

router.get("/", getAllDeliveries);
router.get("/:id/invoice/download", downloadDeliveryInvoice);
router.patch("/:id/status", updateDeliveryStatus);
router.patch("/:id/order-date", updateOrderDate);

module.exports = router;
