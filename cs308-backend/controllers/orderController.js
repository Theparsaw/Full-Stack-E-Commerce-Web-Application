const Order = require("../models/Order");
const Delivery = require("../models/Delivery");
const Product = require("../models/Product");
const { serializeTrackedOrder } = require("../utils/orderTracking");

const CANCELLABLE_DELIVERY_STATUSES = ["processing"];

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
  try {
    const { orderId } = req.params;

    const order = await Order.findById(orderId);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (String(order.userId) !== String(req.user.id)) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (order.status === "cancelled") {
      return res.status(400).json({ message: "Order is already cancelled" });
    }

    if (order.status !== "paid") {
      return res.status(400).json({ message: "Only paid orders can be cancelled" });
    }

    const delivery = await Delivery.findOne({ orderId: order._id.toString() });
    const deliveryStatus = delivery?.status || "processing";

    if (!CANCELLABLE_DELIVERY_STATUSES.includes(deliveryStatus)) {
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
      { new: true }
    );

    if (!cancelledOrder) {
      return res.status(400).json({ message: "Order is no longer eligible for cancellation" });
    }

    for (const item of order.items) {
      await Product.updateOne(
        { productId: item.productId },
        { $inc: { quantityInStock: item.quantity } }
      );
    }

    if (delivery) {
      delivery.status = "cancelled";
      await delivery.save();
    }

    return res.status(200).json({
      message: "Order cancelled successfully",
      order: serializeTrackedOrder(
        cancelledOrder.toObject ? cancelledOrder.toObject() : cancelledOrder,
        delivery
      ),
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to cancel order",
      error: error.message,
    });
  }
};

module.exports = {
  getMyOrders,
  cancelMyOrder,
};
