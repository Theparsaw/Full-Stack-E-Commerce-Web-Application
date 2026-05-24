const express = require("express");
const {
  getCart,
  addItemToCart,
  updateCartItemQuantity,
  removeCartItem,
} = require("../controllers/cartController");
const { authMiddleware } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(authMiddleware);
router.get("/:cartId", getCart);
router.post("/:cartId/items", addItemToCart);
router.patch("/:cartId/items/:productId", updateCartItemQuantity);
router.delete("/:cartId/items/:productId", removeCartItem);

module.exports = router;
