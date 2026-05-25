const Order = require("../models/Order");
const Delivery = require("../models/Delivery");
const Product = require("../models/Product");
const { serializeTrackedOrder } = require("../utils/orderTracking");
const mongoose = require("mongoose");

const CANCELLABLE_DELIVERY_STATUSES = ["processing"];

const withSession = async (query, session) => {
  if (query && typeof query.session === "function") {
    return query.session(session);
  }

  return query;
};

const getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({
      userId: req.user.id,
      status: { $in: ["paid", "cancelled"] },
    })
      .sort({ createdAt: -1 })
      .lean();

    const orderIds = orders.map((order) => String(order._id));

    const deliveries = await Delivery.find({
      orderId: { $in: orderIds },
    }).lean();

    const deliveriesByOrderId = deliveries.reduce((acc, delivery) => {
      acc[String(delivery.orderId)] = delivery;
      return acc;
    }, {});

    return res.status(200).json({
      orders: orders.map((order) =>
        serializeTrackedOrder(order, deliveriesByOrderId[String(order._id)] || null)
      ),
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch orders",
      error: error.message,
    });
  }
};

const cancelMyOrder = async (req, res) => {
  const session = await mongoose.startSession();
  let transactionActive = false;

  const abortActiveTransaction = async () => {
    if (!transactionActive) return;

    await session.abortTransaction();
    transactionActive = false;
  };

  try {
    const { orderId } = req.params;

    session.startTransaction();
    transactionActive = true;

    const order = await withSession(Order.findById(orderId), session);

    if (!order) {
      await abortActiveTransaction();
      return res.status(404).json({ message: "Order not found" });
    }

    if (String(order.userId) !== String(req.user.id)) {
      await abortActiveTransaction();
      return res.status(403).json({ message: "Access denied" });
    }

    if (order.status === "cancelled") {
      await abortActiveTransaction();
      return res.status(400).json({ message: "Order is already cancelled" });
    }

    if (order.status !== "paid") {
      await abortActiveTransaction();
      return res.status(400).json({ message: "Only paid orders can be cancelled" });
    }

    const delivery = await withSession(
      Delivery.findOne({ orderId: order._id.toString() }),
      session
    );
    const deliveryStatus = delivery?.status || "processing";

    if (!CANCELLABLE_DELIVERY_STATUSES.includes(deliveryStatus)) {
      await abortActiveTransaction();
      return res.status(400).json({
        message: "Orders cannot be cancelled after shipment or delivery",
      });
    }

    const cancelledOrder = await Order.findOneAndUpdate(
      {
        _id: order._id,
        userId: req.user.id,
        status: "paid",
      },
      { status: "cancelled" },
      { returnDocument: "after", session }
    );

    if (!cancelledOrder) {
      await abortActiveTransaction();
      return res.status(400).json({ message: "Order is no longer eligible for cancellation" });
    }

    for (const item of order.items) {
      const restoredProduct = await Product.findOneAndUpdate(
        { productId: item.productId },
        { $inc: { quantityInStock: item.quantity } },
        { returnDocument: "after", session }
      );

      if (!restoredProduct) {
        const error = new Error(`Product ${item.productId} was not found`);
        error.statusCode = 404;
        throw error;
      }
    }

    if (delivery) {
      delivery.status = "cancelled";
      await delivery.save({ session });
    }

    await session.commitTransaction();
    transactionActive = false;

    return res.status(200).json({
      message: "Order cancelled successfully",
      order: serializeTrackedOrder(
        cancelledOrder.toObject ? cancelledOrder.toObject() : cancelledOrder,
        delivery
      ),
    });
  } catch (error) {
    await abortActiveTransaction();

    const statusCode = error.statusCode || 500;

    return res.status(statusCode).json({
      message: statusCode === 500 ? "Failed to cancel order" : error.message,
      error: error.message,
    });
  } finally {
    await session.endSession();
  }
};

module.exports = {
  getMyOrders,
  cancelMyOrder,
};
