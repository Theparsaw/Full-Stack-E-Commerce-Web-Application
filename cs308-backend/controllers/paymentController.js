const User = require("../models/User");
const Invoice = require("../models/Invoice");
const { generateInvoicePDF } = require("../utils/invoiceGenerator");
const { sendInvoiceEmail } = require("../utils/emailSender");

const mongoose = require("mongoose");

const Payment = require("../models/Payment");
const Order = require("../models/Order");
const Product = require("../models/Product");
const Cart = require("../models/Cart");
const Delivery = require("../models/Delivery");
const { serializeOrder } = require("../utils/orderTracking");

const normalizeCardHolder = (cardHolder = "") =>
  String(cardHolder).trim().replace(/\s+/g, " ");

const sanitizeCardNumber = (cardNumber = "") => String(cardNumber).replace(/\s+/g, "");

const isValidCardHolder = (cardHolder) => {
  const normalizedName = normalizeCardHolder(cardHolder);
  const letterCount = (normalizedName.match(/\p{L}/gu) || []).length;

  return (
    normalizedName.length >= 2 &&
    normalizedName.length <= 60 &&
    letterCount >= 2 &&
    /^[\p{L}][\p{L}\s'.-]*$/u.test(normalizedName)
  );
};
const isValidCardNumber = (cardNumber) => /^\d{16}$/.test(cardNumber);
const isValidCvv = (cvv) => /^\d{3,4}$/.test(String(cvv));

const isValidExpiry = (expiryMonth, expiryYear) => {
  const monthText = String(expiryMonth).trim();
  const yearText = String(expiryYear).trim();

  if (!/^\d{2}$/.test(monthText)) return false;
  if (!/^\d{4}$/.test(yearText)) return false;

  const month = Number(monthText);
  const year = Number(yearText);
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  if (!Number.isInteger(month) || month < 1 || month > 12) return false;
  if (!Number.isInteger(year) || year < currentYear) return false;
  if (year === currentYear && month < currentMonth) return false;

  return true;
};

const simulatePaymentResult = (cardNumber) => {
  const lastDigit = Number(cardNumber[cardNumber.length - 1]);
  return lastDigit % 2 === 0;
};

const serializeDelivery = (delivery) => {
  if (!delivery) return null;

  const deliveryObject = typeof delivery.toObject === "function"
    ? delivery.toObject()
    : delivery;

  const serializedDelivery = {
    _id: deliveryObject._id,
    orderId: deliveryObject.orderId,
    userId: deliveryObject.userId,
    items: deliveryObject.items,
    totalPrice: deliveryObject.totalPrice,
    address: deliveryObject.address,
    status: deliveryObject.status,
  };

  if (deliveryObject.createdAt) serializedDelivery.createdAt = deliveryObject.createdAt;
  if (deliveryObject.updatedAt) serializedDelivery.updatedAt = deliveryObject.updatedAt;

  return serializedDelivery;
};

const validateOrderStock = async (items) => {
  for (const item of items) {
    const product = await Product.findOne({ productId: item.productId });

    if (!product) {
      return {
        valid: false,
        message: `Product not found: ${item.productId}`,
      };
    }

    if (product.quantityInStock < item.quantity) {
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

const getOrderForPayment = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.userId !== req.user.id) {
      return res.status(403).json({ message: "Access denied" });
    }

    const stockCheck = await validateOrderStock(order.items);

    if (!stockCheck.valid) {
      return res.status(400).json(stockCheck);
    }

    return res.status(200).json({
      order: serializeOrder(order),
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch order",
      error: error.message,
    });
  }
};

const processPayment = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { cardHolder, cardNumber, expiryMonth, expiryYear, cvv } = req.body;
    const normalizedCardHolder = normalizeCardHolder(cardHolder);
    const cleanedCardNumber = sanitizeCardNumber(cardNumber);
    const normalizedExpiryMonth = String(expiryMonth ?? "").trim();
    const normalizedExpiryYear = String(expiryYear ?? "").trim();
    const normalizedCvv = String(cvv ?? "").trim();

    if (!normalizedCardHolder || !cleanedCardNumber || !normalizedExpiryMonth || !normalizedExpiryYear || !normalizedCvv) {
      return res.status(400).json({
        message: "All payment fields are required",
      });
    }

    if (!isValidCardHolder(normalizedCardHolder)) {
      return res.status(400).json({
        message: "Cardholder name must contain only letters, spaces, apostrophes, hyphens, or periods",
      });
    }

    if (!isValidCardNumber(cleanedCardNumber)) {
      return res.status(400).json({
        message: "Card number must be 16 digits",
      });
    }

    if (!isValidExpiry(normalizedExpiryMonth, normalizedExpiryYear)) {
      return res.status(400).json({
        message: "Card expiry date is invalid or expired",
      });
    }

    if (!isValidCvv(normalizedCvv)) {
      return res.status(400).json({
        message: "CVV must be 3 or 4 digits",
      });
    }

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({
        message: "Order not found",
      });
    }

    if (order.userId !== req.user.id) {
      return res.status(403).json({
        message: "Access denied",
      });
    }

    // PREVENT DUPLICATE PROCESSING
    if (order.status === "paid") {
      return res.status(400).json({
        message: "Order has already been paid",
      });
    }

    const stockCheck = await validateOrderStock(order.items);

    if (!stockCheck.valid) {
      order.status = "payment_failed";
      await order.save();
      return res.status(400).json(stockCheck);
    }

    const success = simulatePaymentResult(cleanedCardNumber);

    const payment = await Payment.create({
      orderId: order._id.toString(),
      userId: req.user.id,
      amount: order.totalPrice,
      status: success ? "success" : "failed",
      cardLast4: cleanedCardNumber.slice(-4),
      transactionId: `TXN-${Date.now()}`,
      message: success ? "Payment completed successfully" : "Payment was declined",
    });

    // IF PAYMENT FAILED, WE STOP HERE
    if (!success) {
      order.status = "payment_failed";
      await order.save();

      return res.status(200).json({
        success: false,
        message: "Payment was declined",
        paymentStatus: payment.status,
        payment: {
          id: payment._id,
          orderId: payment.orderId,
          amount: payment.amount,
          status: payment.status,
          cardLast4: payment.cardLast4,
          transactionId: payment.transactionId,
          createdAt: payment.createdAt,
        },
        order: serializeOrder(order),
      });
    }

    // ==========================================
    // 🟢 MONGODB TRANSACTION LOGIC STARTS HERE 🟢
    // ==========================================
    const session = await mongoose.startSession();
    session.startTransaction();

    let delivery; 

    try {
      for (const item of order.items) {
        const product = await Product.findOneAndUpdate(
          { 
            productId: item.productId, 
            quantityInStock: { $gte: item.quantity } 
          },
          { $inc: { quantityInStock: -item.quantity } },
          { session, new: true }
        );

        if (!product) {
          throw new Error(`Concurrency Error: Not enough stock remaining for ${item.name}.`);
        }
      }

      order.status = "paid";
      order.paidAt = new Date();
      await order.save({ session });

      const cart = await Cart.findOne({ cartId: order.cartId }).session(session);
      if (cart) {
        cart.items = [];
        cart.totalPrice = 0;
        await cart.save({ session });
      }

      const deliveryRecords = await Delivery.create([{
        orderId: order._id.toString(),
        userId: order.userId,
        items: order.items,
        totalPrice: order.totalPrice,
        address: "Default address",
        status: "processing",
      }], { session });
      
      delivery = deliveryRecords[0];

      await session.commitTransaction();
      session.endSession();

    } catch (transactionError) {
      await session.abortTransaction();
      session.endSession();
      console.error("Transaction aborted:", transactionError);

      order.status = "payment_failed"; 
      await order.save();
      
      if (payment.status === "success") {
        payment.status = "refunded";
        payment.message = "Payment refunded due to stock concurrency error";
        await payment.save();
      }

      return res.status(500).json({
        success: false,
        message: "A system error occurred while finalizing your order. You have not been charged.",
        error: transactionError.message
      });
    }

    // ==========================================
    // INVOICE GENERATION 
    // ==========================================
    try {
      const user = await User.findById(order.userId);
      const invoiceNum = `INV-${order._id.toString().slice(-6).toUpperCase()}`;
      const pdfBuffer = await generateInvoicePDF(order, user);
      const emailSent = await sendInvoiceEmail(user.email, invoiceNum, pdfBuffer);
      
      await Invoice.create({
        orderId: order._id.toString(),
        userId: order.userId,
        invoiceNumber: invoiceNum,
        amount: order.totalPrice,
        status: emailSent ? "emailed" : "failed",
      });
    } catch (invoiceError) {
      console.error("Invoice generation failed:", invoiceError);
    }

    return res.status(200).json({
      success: true,
      message: "Payment completed successfully",
      paymentStatus: payment.status,
      delivery: serializeDelivery(delivery),
      order: serializeOrder(order),
    });

  } catch (error) {
    return res.status(500).json({
      message: "Failed to process payment",
      error: error.message,
    });
  }
};

module.exports = {
  getOrderForPayment,
  processPayment,
};
