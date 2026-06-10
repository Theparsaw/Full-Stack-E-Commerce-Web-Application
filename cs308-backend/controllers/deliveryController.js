const Delivery = require("../models/Delivery");
const Invoice = require("../models/Invoice");
const Order = require("../models/Order");
const Payment = require("../models/Payment");
const User = require("../models/User");
const AppError = require("../utils/appError");
const asyncHandler = require("../utils/asyncHandler");
const { generateInvoicePDF } = require("../utils/invoiceGenerator");
const { decryptValue } = require("../utils/encryption");

const ALLOWED_DELIVERY_STATUSES = [
  "processing",
  "out_for_delivery",
  "delivered",
  "cancelled",
];

const serializeDelivery = (delivery, userMap = {}, invoiceMap = {}) => {
  const userId = String(delivery.userId || "");
  const orderId = String(delivery.orderId || "");
  const invoice = invoiceMap[orderId] || null;

  return {
    id: delivery._id,
    orderId: delivery.orderId,
    userId: delivery.userId,
    customerName: userMap[userId]?.name || "Unknown User",
    customerEmail: userMap[userId]?.email || "",
    items: delivery.items,
    totalPrice: delivery.totalPrice,
    address: delivery.address,
    status: delivery.status,
    createdAt: delivery.createdAt,
    updatedAt: delivery.updatedAt,

    // Invoice summary for product manager delivery view
    invoiceId: invoice?._id || null,
    invoiceNumber: invoice ? decryptValue(invoice.invoiceNumber) : "",
    invoiceStatus: invoice?.status || "",
    invoiceAmount: invoice?.amount || null,
  };
};

const getAllDeliveries = asyncHandler(async (_req, res) => {
  const deliveries = await Delivery.find().sort({ createdAt: -1 }).lean();

  const userIds = [
    ...new Set(
      deliveries
        .map((delivery) => String(delivery.userId || ""))
        .filter(Boolean)
    ),
  ];

  const orderIds = [
    ...new Set(
      deliveries
        .map((delivery) => String(delivery.orderId || ""))
        .filter(Boolean)
    ),
  ];

  const users = userIds.length
    ? await User.find({ _id: { $in: userIds } })
        .select("_id name email")
        .lean()
    : [];

  const invoices = orderIds.length
    ? await Invoice.find({ orderId: { $in: orderIds } })
        .select("_id orderId invoiceNumber amount status")
        .lean()
    : [];

  const userMap = users.reduce((acc, user) => {
    acc[String(user._id)] = {
      name: user.name,
      email: user.email,
    };
    return acc;
  }, {});

  const invoiceMap = invoices.reduce((acc, invoice) => {
    acc[String(invoice.orderId)] = invoice;
    return acc;
  }, {});

  return res.status(200).json({
    success: true,
    count: deliveries.length,
    data: deliveries.map((delivery) =>
      serializeDelivery(delivery, userMap, invoiceMap)
    ),
  });
});

const updateDeliveryStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status || !String(status).trim()) {
    throw new AppError("status is required", 400, "VALIDATION_ERROR");
  }

  const normalizedStatus = String(status).trim();

  if (!ALLOWED_DELIVERY_STATUSES.includes(normalizedStatus)) {
    throw new AppError(
      `Invalid delivery status. Allowed values: ${ALLOWED_DELIVERY_STATUSES.join(", ")}`,
      400,
      "INVALID_DELIVERY_STATUS"
    );
  }

  const delivery = await Delivery.findById(id);

  if (!delivery) {
    throw new AppError("Delivery not found", 404, "DELIVERY_NOT_FOUND");
  }

  delivery.status = normalizedStatus;
  await delivery.save();

  const user = delivery.userId
    ? await User.findById(delivery.userId).select("_id name email").lean()
    : null;

  const invoice = delivery.orderId
    ? await Invoice.findOne({ orderId: String(delivery.orderId) })
        .select("_id orderId invoiceNumber amount status")
        .lean()
    : null;

  const userMap = user
    ? {
        [String(user._id)]: {
          name: user.name,
          email: user.email,
        },
      }
    : {};

  const invoiceMap = invoice
    ? {
        [String(invoice.orderId)]: invoice,
      }
    : {};

  return res.status(200).json({
    success: true,
    message: "Delivery status updated successfully",
    data: serializeDelivery(delivery.toObject(), userMap, invoiceMap),
  });
});

const updateOrderDate = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const requestedDate = new Date(req.body?.orderDate);

  if (!req.body?.orderDate || Number.isNaN(requestedDate.getTime())) {
    throw new AppError("A valid order date is required", 400, "VALIDATION_ERROR");
  }

  if (requestedDate > new Date()) {
    throw new AppError("Order date cannot be in the future", 400, "VALIDATION_ERROR");
  }

  const delivery = await Delivery.findById(id).lean();
  if (!delivery) {
    throw new AppError("Delivery not found", 404, "DELIVERY_NOT_FOUND");
  }

  const order = await Order.findById(delivery.orderId).lean();
  if (!order) {
    throw new AppError("Order not found for this delivery", 404, "ORDER_NOT_FOUND");
  }

  if (order.status !== "paid") {
    throw new AppError(
      "Only paid orders can have their demo date changed",
      400,
      "ORDER_NOT_PAID"
    );
  }

  await Promise.all([
    Order.collection.updateOne(
      { _id: order._id },
      { $set: { paidAt: requestedDate, createdAt: requestedDate } }
    ),
    Delivery.collection.updateOne(
      { _id: delivery._id },
      { $set: { createdAt: requestedDate } }
    ),
    Payment.collection.updateMany(
      { orderId: String(order._id) },
      { $set: { createdAt: requestedDate } }
    ),
    Invoice.collection.updateOne(
      { orderId: String(order._id) },
      { $set: { createdAt: requestedDate } }
    ),
  ]);

  return res.status(200).json({
    success: true,
    message: "Order date updated across the linked demo records",
    data: {
      deliveryId: String(delivery._id),
      orderId: String(order._id),
      orderDate: requestedDate,
    },
  });
});

const downloadDeliveryInvoice = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const delivery = await Delivery.findById(id).lean();

  if (!delivery) {
    throw new AppError("Delivery not found", 404, "DELIVERY_NOT_FOUND");
  }

  const invoice = await Invoice.findOne({
    orderId: String(delivery.orderId),
  }).lean();

  if (!invoice) {
    throw new AppError(
      "Invoice not found for this delivery",
      404,
      "DELIVERY_INVOICE_NOT_FOUND"
    );
  }

  if (String(invoice.userId) !== String(delivery.userId)) {
    throw new AppError(
      "Invoice does not match this delivery customer",
      409,
      "DELIVERY_INVOICE_MISMATCH"
    );
  }

  const order = await Order.findOne({
    _id: invoice.orderId,
    userId: invoice.userId,
    status: "paid",
  }).lean();

  if (!order) {
    throw new AppError(
      "Paid order for this invoice was not found",
      404,
      "PAID_ORDER_NOT_FOUND"
    );
  }

  const user = await User.findById(invoice.userId).select("name email address");

  if (!user) {
    throw new AppError("Customer not found", 404, "CUSTOMER_NOT_FOUND");
  }

  const pdfBuffer = await generateInvoicePDF(order, user);
  const safeInvoiceNumber = decryptValue(invoice.invoiceNumber).replace(/[^a-zA-Z0-9_-]/g, "_");

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${safeInvoiceNumber}.pdf"`
  );

  return res.status(200).send(pdfBuffer);
});

module.exports = {
  getAllDeliveries,
  updateDeliveryStatus,
  updateOrderDate,
  downloadDeliveryInvoice,
};
