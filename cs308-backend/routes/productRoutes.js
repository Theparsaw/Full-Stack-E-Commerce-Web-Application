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
const { uploadProductImage } = require("../middleware/uploadMiddleware");

router
  .route("/")
  .get(getAllProducts)
  .post(authMiddleware, authorize("product_manager"), uploadProductImage.single("productImage"), createProduct);

router
  .route("/:id/price")
  .put(authMiddleware, authorize("sales_manager"), updateProductPrice);

router
  .route("/:id")
  .get(getProductById)
  .put(authMiddleware, authorize("product_manager"), uploadProductImage.single("productImage"), updateProduct)
  .delete(authMiddleware, authorize("product_manager"), deleteProduct);

module.exports = router;
