const express = require("express");
const router = express.Router();

const {
  createProduct,
  getAllProducts,
  getProductById,
  updateProduct,
  updateProductPrice,
  deleteProduct,
} = require("../controllers/productController");

const { authMiddleware, authorize } = require("../middleware/authMiddleware");

router
  .route("/")
  .get(getAllProducts)
  .post(authMiddleware, authorize("product_manager"), createProduct);

router
  .route("/:id/price")
  .put(authMiddleware, authorize("sales_manager"), updateProductPrice);

router
  .route("/:id")
  .get(getProductById)
  .put(authMiddleware, authorize("product_manager"), updateProduct)
  .delete(authMiddleware, authorize("product_manager"), deleteProduct);

module.exports = router;