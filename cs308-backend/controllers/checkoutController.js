const Cart = require("../models/Cart");
const Product = require("../models/Product");
const Order = require("../models/Order");
const { serializeOrder } = require("../utils/orderTracking");

const assertCartAccess = (cart, userId) => {
  if (String(cart.userId) !== String(userId)) {
    return {
      valid: false,
      message: "You are not allowed to access this cart",
    };
  }

  return { valid: true };
};

const validateCartStock = async (cartItems) => {
  for (const item of cartItems) {
    const product = await Product.findOne({ productId: item.productId });

    if (!product) {
      return {
        valid: false,
        message: `Product not found: ${item.productId}`,
      };
    }

    if (item.quantity > product.quantityInStock) {
      return {
        valid: false,
        message: `Not enough stock for ${item.name}`,
        productId: item.productId,
        availableStock: product.quantityInStock,
      };
    }
  }

  return { valid: true };
};

const getCheckoutCart = async (req, res) => {
  try {
    const { cartId } = req.params;

    const cart = await Cart.findOne({ cartId });

    if (!cart || cart.items.length === 0) {
      return res.status(404).json({
        message: "Cart is empty or not found",
      });
    }

    const accessCheck = assertCartAccess(cart, req.user.id);

    if (!accessCheck.valid) {
      return res.status(403).json(accessCheck);
    }

    return res.status(200).json({
      cartId: cart.cartId,
      items: cart.items,
      totalPrice: cart.totalPrice,
      totalItems: cart.items.reduce((sum, item) => sum + item.quantity, 0),
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch checkout cart",
      error: error.message,
    });
  }
};

const validateCheckout = async (req, res) => {
  try {
    const { cartId } = req.params;

    const cart = await Cart.findOne({ cartId });

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({
        message: "Cart is empty or not found",
      });
    }

    const accessCheck = assertCartAccess(cart, req.user.id);

    if (!accessCheck.valid) {
      return res.status(403).json(accessCheck);
    }

    const stockCheck = await validateCartStock(cart.items);

    if (!stockCheck.valid) {
      return res.status(400).json(stockCheck);
    }

    return res.status(200).json({
      message: "Checkout validation successful",
      valid: true,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to validate checkout",
      error: error.message,
    });
  }
};

const createOrder = async (req, res) => {
  try {
    const { cartId } = req.params;

    const cart = await Cart.findOne({ cartId });

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({
        message: "Cart is empty or not found",
      });
    }

    const accessCheck = assertCartAccess(cart, req.user.id);

    if (!accessCheck.valid) {
      return res.status(403).json(accessCheck);
    }

    const stockCheck = await validateCartStock(cart.items);

    if (!stockCheck.valid) {
      return res.status(400).json(stockCheck);
    }

    const order = await Order.create({
      userId: req.user.id,
      cartId: cart.cartId,
      items: cart.items,
      totalPrice: cart.totalPrice,
      status: "pending_payment",
    });

    return res.status(201).json({
      message: "Order created successfully",
      order: serializeOrder(order),
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to create order",
      error: error.message,
    });
  }
};

module.exports = {
  getCheckoutCart,
  validateCheckout,
  createOrder,
};
