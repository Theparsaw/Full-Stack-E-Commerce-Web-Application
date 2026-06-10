const Invoice = require("../models/Invoice");
const Order = require("../models/Order");
const Product = require("../models/Product");
const ReturnRequest = require("../models/ReturnRequest");
const User = require("../models/User");
const { generateInvoicePDF } = require("../utils/invoiceGenerator");
const { decryptValue } = require("../utils/encryption");

const serializeInvoice = (invoice) => ({
  id: invoice._id,
  orderId: invoice.orderId,
  invoiceNumber: decryptValue(invoice.invoiceNumber),
  amount: invoice.amount,
  status: invoice.status,
  createdAt: invoice.createdAt,
  updatedAt: invoice.updatedAt,
});

const parseDateRange = (query = {}) => {
  const startDate = query.startDate ? new Date(query.startDate) : null;
  const endDate = query.endDate ? new Date(query.endDate) : null;

  if (startDate && Number.isNaN(startDate.getTime())) {
    return { error: "startDate is invalid" };
  }

  if (endDate && Number.isNaN(endDate.getTime())) {
    return { error: "endDate is invalid" };
  }

  if (endDate) {
    endDate.setUTCHours(23, 59, 59, 999);
  }

  if (startDate && endDate && startDate > endDate) {
    return { error: "startDate must be before or equal to endDate" };
  }

  const createdAt = {};
  if (startDate) createdAt.$gte = startDate;
  if (endDate) createdAt.$lte = endDate;

  return {
    startDate,
    endDate,
    filter: Object.keys(createdAt).length ? { createdAt } : {},
  };
};

const getOrderDate = (order) => order.paidAt || order.createdAt;

const getLineOriginalPrice = (item) =>
  Number(item.originalPrice ?? item.unitPrice ?? 0);

const getLineDiscountLoss = (item) => {
  const originalPrice = getLineOriginalPrice(item);
  const unitPrice = Number(item.unitPrice || 0);
  return Math.max(0, originalPrice - unitPrice) * Number(item.quantity || 0);
};

const roundMoney = (value) => Number(Number(value || 0).toFixed(2));

const getItemCost = (item, costsByProductId) => {
  if (item.costPrice !== undefined && item.costPrice !== null) {
    return Number(item.costPrice || 0);
  }

  return Number(costsByProductId.get(String(item.productId)) || 0);
};

const createReportPoint = (date) => ({
  date,
  grossRevenue: 0,
  refunds: 0,
  revenue: 0,
  costOfGoods: 0,
  profitLoss: 0,
  discountLoss: 0,
  orders: 0,
  itemsSold: 0,
  returnedItems: 0,
});

const buildReportSummary = (orders, refunds, costsByProductId, refundOrders = []) => {
  const summaryByDate = new Map();

  let grossRevenue = 0;
  let refundTotal = 0;
  let grossCostOfGoods = 0;
  let refundedCostOfGoods = 0;
  let discountLoss = 0;
  let itemsSold = 0;
  let returnedItems = 0;
  let legacyCostItems = 0;
  const ordersById = new Map(
    [...orders, ...refundOrders].map((order) => [String(order._id), order])
  );

  orders.forEach((order) => {
    const orderRevenue = Number(order.totalPrice || 0);
    const orderDiscountLoss = (order.items || []).reduce(
      (sum, item) => sum + getLineDiscountLoss(item),
      0
    );
    const orderItemsSold = (order.items || []).reduce(
      (sum, item) => sum + Number(item.quantity || 0),
      0
    );
    const orderCost = (order.items || []).reduce((sum, item) => {
      if (item.costPrice === undefined || item.costPrice === null) {
        legacyCostItems += Number(item.quantity || 0);
      }
      return sum + getItemCost(item, costsByProductId) * Number(item.quantity || 0);
    }, 0);
    const dateKey = getOrderDate(order)?.toISOString().slice(0, 10) || "unknown";

    grossRevenue += orderRevenue;
    grossCostOfGoods += orderCost;
    discountLoss += orderDiscountLoss;
    itemsSold += orderItemsSold;

    const current = summaryByDate.get(dateKey) || createReportPoint(dateKey);

    current.grossRevenue += orderRevenue;
    current.revenue += orderRevenue;
    current.costOfGoods += orderCost;
    current.profitLoss = current.revenue - current.costOfGoods;
    current.discountLoss += orderDiscountLoss;
    current.orders += 1;
    current.itemsSold += orderItemsSold;
    summaryByDate.set(dateKey, current);
  });

  refunds.forEach((refund) => {
    const order = ordersById.get(String(refund.orderId));
    const dateKey = (refund.resolvedAt || refund.resolutionDate || refund.updatedAt)
      ?.toISOString()
      .slice(0, 10) || "unknown";
    const refundAmount = Number(refund.refundAmount || 0);
    let refundCost = 0;
    let refundItems = 0;

    (refund.items || []).forEach((returnedItem) => {
      const matchingOrderItem = (order?.items || []).find(
        (item) => String(item.productId) === String(returnedItem.productId)
      );
      const quantity = Number(returnedItem.quantity || 0);
      refundItems += quantity;
      refundCost += getItemCost(matchingOrderItem || returnedItem, costsByProductId) * quantity;
    });

    refundTotal += refundAmount;
    refundedCostOfGoods += refundCost;
    returnedItems += refundItems;

    const current = summaryByDate.get(dateKey) || createReportPoint(dateKey);
    current.refunds += refundAmount;
    current.revenue -= refundAmount;
    current.costOfGoods -= refundCost;
    current.profitLoss = current.revenue - current.costOfGoods;
    current.returnedItems += refundItems;
    summaryByDate.set(dateKey, current);
  });

  const revenue = grossRevenue - refundTotal;
  const costOfGoods = grossCostOfGoods - refundedCostOfGoods;

  return {
    grossRevenue: roundMoney(grossRevenue),
    refunds: roundMoney(refundTotal),
    revenue: roundMoney(revenue),
    costOfGoods: roundMoney(costOfGoods),
    profitLoss: roundMoney(revenue - costOfGoods),
    discountLoss: roundMoney(discountLoss),
    orderCount: orders.length,
    itemsSold,
    returnedItems,
    legacyCostItems,
    chart: Array.from(summaryByDate.values())
      .sort((left, right) => left.date.localeCompare(right.date))
      .map((point) => ({
        ...point,
        grossRevenue: roundMoney(point.grossRevenue),
        refunds: roundMoney(point.refunds),
        revenue: roundMoney(point.revenue),
        costOfGoods: roundMoney(point.costOfGoods),
        profitLoss: roundMoney(point.profitLoss),
        discountLoss: roundMoney(point.discountLoss),
      })),
  };
};

const getMyInvoices = async (req, res) => {
  try {
    const invoices = await Invoice.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      invoices: invoices.map(serializeInvoice),
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch invoices",
      error: error.message,
    });
  }
};

const getSalesInvoices = async (req, res) => {
  try {
    const range = parseDateRange(req.query);

    if (range.error) {
      return res.status(400).json({ message: range.error });
    }

    const invoices = await Invoice.find(range.filter)
      .sort({ createdAt: -1 })
      .lean();
    const userIds = [...new Set(invoices.map((invoice) => invoice.userId))];
    const users = userIds.length
      ? await User.find({ _id: { $in: userIds } }).select("_id name email").lean()
      : [];
    const usersById = users.reduce((acc, user) => {
      acc[String(user._id)] = user;
      return acc;
    }, {});
    const totalAmount = invoices.reduce(
      (sum, invoice) => sum + Number(invoice.amount || 0),
      0
    );

    return res.status(200).json({
      invoices: invoices.map((invoice) => ({
        ...serializeInvoice(invoice),
        userId: invoice.userId,
        customerName: usersById[invoice.userId]?.name || "Unknown User",
        customerEmail: usersById[invoice.userId]?.email || "",
      })),
      summary: {
        count: invoices.length,
        totalAmount: Number(totalAmount.toFixed(2)),
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch sales invoices",
      error: error.message,
    });
  }
};

const getSalesReport = async (req, res) => {
  try {
    const range = parseDateRange(req.query);

    if (range.error) {
      return res.status(400).json({ message: range.error });
    }

    const paidAt = {};
    if (range.startDate) paidAt.$gte = range.startDate;
    if (range.endDate) paidAt.$lte = range.endDate;

    const filter = {
      status: "paid",
      ...(Object.keys(paidAt).length ? { paidAt } : {}),
    };
    const orders = await Order.find(filter).sort({ paidAt: 1, createdAt: 1 }).lean();
    const resolutionDate = {};
    if (range.startDate) resolutionDate.$gte = range.startDate;
    if (range.endDate) resolutionDate.$lte = range.endDate;
    const refunds = await ReturnRequest.find({
      status: "approved",
      ...(Object.keys(resolutionDate).length
        ? {
            $or: [
              { resolvedAt: resolutionDate },
              { resolvedAt: null, resolutionDate },
            ],
          }
        : {}),
    }).lean();
    const orderIdsInRange = new Set(orders.map((order) => String(order._id)));
    const missingRefundOrderIds = [
      ...new Set(
        refunds
          .map((refund) => String(refund.orderId))
          .filter((orderId) => !orderIdsInRange.has(orderId))
      ),
    ];
    const missingRefundOrders = missingRefundOrderIds.length
      ? await Order.find({ _id: { $in: missingRefundOrderIds } }).lean()
      : [];
    const reportOrdersById = new Map(
      [...orders, ...missingRefundOrders].map((order) => [String(order._id), order])
    );
    const productIds = [
      ...new Set(
        [...reportOrdersById.values()]
          .flatMap((order) => order.items || [])
          .map((item) => String(item.productId))
      ),
    ];
    const products = productIds.length
      ? await Product.find({ productId: { $in: productIds } })
          .select("productId costPrice")
          .lean()
      : [];
    const costsByProductId = new Map(
      products.map((product) => [String(product.productId), Number(product.costPrice || 0)])
    );

    return res.status(200).json({
      summary: buildReportSummary(orders, refunds, costsByProductId, missingRefundOrders),
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to calculate sales report",
      error: error.message,
    });
  }
};

const downloadInvoice = async (req, res) => {
  try {
    const { invoiceId } = req.params;

    const invoice = await Invoice.findOne({
      _id: invoiceId,
      userId: req.user.id,
    }).lean();

    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    const order = await Order.findOne({
      _id: invoice.orderId,
      userId: req.user.id,
      status: "paid",
    }).lean();

    if (!order) {
      return res.status(404).json({ message: "Paid order for this invoice was not found" });
    }

    const user = await User.findById(req.user.id).select("name email address");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const pdfBuffer = await generateInvoicePDF(order, user);
    const safeInvoiceNumber = decryptValue(invoice.invoiceNumber).replace(/[^a-zA-Z0-9_-]/g, "_");

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${safeInvoiceNumber}.pdf"`
    );

    return res.status(200).send(pdfBuffer);
  } catch (error) {
    return res.status(500).json({
      message: "Failed to download invoice",
      error: error.message,
    });
  }
};

const downloadSalesInvoice = async (req, res) => {
  try {
    const { invoiceId } = req.params;

    const invoice = await Invoice.findOne({ _id: invoiceId }).lean();

    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    const order = await Order.findOne({
      _id: invoice.orderId,
      status: "paid",
    }).lean();

    if (!order) {
      return res.status(404).json({ message: "Paid order for this invoice was not found" });
    }

    const user = await User.findById(invoice.userId).select("name email address");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const pdfBuffer = await generateInvoicePDF(order, user);
    const safeInvoiceNumber = decryptValue(invoice.invoiceNumber).replace(/[^a-zA-Z0-9_-]/g, "_");

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${safeInvoiceNumber}.pdf"`
    );

    return res.status(200).send(pdfBuffer);
  } catch (error) {
    return res.status(500).json({
      message: "Failed to download sales invoice",
      error: error.message,
    });
  }
};

module.exports = {
  getMyInvoices,
  getSalesInvoices,
  getSalesReport,
  downloadInvoice,
  downloadSalesInvoice,
};
